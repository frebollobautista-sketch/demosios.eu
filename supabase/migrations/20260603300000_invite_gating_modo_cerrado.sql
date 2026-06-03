-- ============================================================
-- OCRE: Modo cerrado — gating por invitación
-- Migración: 20260603300000_invite_gating_modo_cerrado.sql
-- 1. handle_new_user exige y canjea una invitación válida (atómico)
-- 2. RPC validar_invitacion (pre-check anónimo, no canjea)
-- 3. RPC generar_invitaciones (crea códigos del usuario, con tope)
-- 4. Seed de códigos maestros para no autobloquearse
-- Idempotente.
-- ============================================================

-- 1. Trigger: crea profile SOLO si hay invitación válida; la canjea.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code text := nullif(trim(new.raw_user_meta_data->>'invite_code'), '');
  v_inv  public.invitations%rowtype;
begin
  if v_code is null then
    raise exception 'invitacion_requerida' using errcode = 'P0001';
  end if;

  select * into v_inv
  from public.invitations
  where lower(code) = lower(v_code)
    and used_by is null
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    raise exception 'invitacion_invalida' using errcode = 'P0001';
  end if;

  update public.invitations
    set used_by = new.id, used_at = now()
    where id = v_inv.id;

  insert into public.profiles (id, handle, display_name, invited_by, invitation_code)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'handle',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    ),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    v_inv.created_by,
    v_inv.code
  );
  return new;

exception when unique_violation then
  insert into public.profiles (id, handle, display_name, invited_by, invitation_code)
  values (
    new.id,
    split_part(new.email, '@', 1) || '_' || substr(gen_random_uuid()::text, 1, 6),
    split_part(new.email, '@', 1),
    v_inv.created_by,
    v_inv.code
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Pre-check anónimo (no canjea): error amable en el registro.
create or replace function public.validar_invitacion(p_code text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.invitations
    where lower(code) = lower(trim(p_code))
      and used_by is null
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.validar_invitacion(text) from public;
grant execute on function public.validar_invitacion(text) to anon, authenticated;

-- 3. Generar invitaciones del usuario (tope INVITES_PER_USER = 5).
create or replace function public.generar_invitaciones(p_n int default null)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_cap  int  := 5;
  v_have int;
  v_make int;
  v_code text;
  i int;
begin
  if v_uid is null then
    raise exception 'no_autenticado' using errcode = 'P0001';
  end if;
  select count(*) into v_have from public.invitations where created_by = v_uid;
  v_make := least(coalesce(p_n, v_cap - v_have), v_cap - v_have);
  if v_make <= 0 then return; end if;
  for i in 1..v_make loop
    loop
      v_code := 'OCRE-' ||
        upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
        upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      exit when not exists (select 1 from public.invitations where code = v_code);
    end loop;
    insert into public.invitations (code, created_by) values (v_code, v_uid);
    return next v_code;
  end loop;
end;
$$;

revoke all on function public.generar_invitaciones(int) from public;
grant execute on function public.generar_invitaciones(int) to authenticated;

-- 4. Seed de códigos maestros (creados por el admin) para arrancar/probar.
insert into public.invitations (code, created_by)
select v.code, '2e2bf5bf-19db-40ba-952f-1640b5a55b20'::uuid
from (values ('OCRE-ALPHA-0001'), ('OCRE-ALPHA-0002'), ('OCRE-ALPHA-0003')) as v(code)
where not exists (select 1 from public.invitations i where i.code = v.code);
