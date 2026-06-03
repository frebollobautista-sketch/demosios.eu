-- ============================================================
-- OCRE: Núcleo de autenticación, perfil y RGPD
-- Migración: 20260603000000_auth_perfil_rgpd.sql
-- Descripción:
--   1. Trigger handle_new_user (replicado del dashboard, versionado)
--   2. Columnas de perfil: ubicación, avatar_color, enlaces,
--      onboarding_completed (idempotente, con IF NOT EXISTS)
--   3. RPC handle_disponible() para validación en tiempo real
--   4. Bucket de Storage 'avatars' + políticas RLS
--   5. Tabla bloqueos + RLS + helper esta_bloqueado()
--   6. RPC delete_my_account() (borrado RGPD vía SECURITY DEFINER)
--
-- IMPORTANTE: todo es idempotente. La BD en producción tiene "drift"
-- (objetos creados a mano en el dashboard que no estaban versionados),
-- por eso usamos IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Trigger que crea la fila en profiles al registrarse
--    (vivía solo en el dashboard; lo versionamos aquí)
-- ────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'handle',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    ),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
exception when unique_violation then
  -- Si el handle ya existe, añadimos un sufijo aleatorio
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1) || '_' || substr(gen_random_uuid()::text, 1, 6),
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- 2. Columnas de perfil (idempotentes)
--    Varias ya existen en producción; IF NOT EXISTS las deja igual.
-- ────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists avatar_color text default '#A14B2A',
  add column if not exists isla_id text,
  add column if not exists municipio_id text,
  add column if not exists barrio_id text,
  add column if not exists is_public boolean default true,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists enlaces jsonb not null default '[]'::jsonb;

comment on column public.profiles.onboarding_completed is
  'true cuando el usuario ha completado el onboarding (barrio, intereses, handle).';
comment on column public.profiles.enlaces is
  'Enlaces externos del perfil: array JSON de {etiqueta, url}.';

-- Los usuarios que ya existían (2 perfiles seed) se consideran onboarded
-- para no forzarles a pasar por el onboarding retroactivamente.
update public.profiles
  set onboarding_completed = true
  where onboarding_completed = false
    and created_at < '2026-06-03';


-- ────────────────────────────────────────────────────────────
-- 3. RPC: disponibilidad de handle (case-insensitive)
--    Usable por anon (durante el registro) y authenticated.
-- ────────────────────────────────────────────────────────────

create or replace function public.handle_disponible(p_handle text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where lower(handle) = lower(trim(p_handle))
  );
$$;

revoke all on function public.handle_disponible(text) from public;
grant execute on function public.handle_disponible(text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. Storage: bucket 'avatars' (lectura pública, escritura del dueño)
--    Convención de ruta: avatars/<auth.uid>/<archivo>
-- ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ────────────────────────────────────────────────────────────
-- 5. Bloqueos entre usuarios
-- ────────────────────────────────────────────────────────────

create table if not exists public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  bloqueador_id uuid references public.profiles(id) on delete cascade not null,
  bloqueado_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (bloqueador_id, bloqueado_id),
  check (bloqueador_id <> bloqueado_id)
);

create index if not exists idx_bloqueos_bloqueador on public.bloqueos(bloqueador_id);
create index if not exists idx_bloqueos_bloqueado on public.bloqueos(bloqueado_id);

alter table public.bloqueos enable row level security;

-- Cada usuario ve, crea y borra solo SUS bloqueos (los que él inició).
drop policy if exists "bloqueos_select_own" on public.bloqueos;
create policy "bloqueos_select_own"
  on public.bloqueos for select
  using (bloqueador_id = auth.uid() or is_admin());

drop policy if exists "bloqueos_insert_own" on public.bloqueos;
create policy "bloqueos_insert_own"
  on public.bloqueos for insert
  with check (bloqueador_id = auth.uid());

drop policy if exists "bloqueos_delete_own" on public.bloqueos;
create policy "bloqueos_delete_own"
  on public.bloqueos for delete
  using (bloqueador_id = auth.uid());

-- ¿Hay bloqueo entre dos usuarios en CUALQUIER dirección?
-- SECURITY DEFINER para poder consultarse desde feeds sin chocar con la
-- RLS de bloqueos (que solo deja ver los propios).
create or replace function public.esta_bloqueado(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.bloqueos
    where (bloqueador_id = p_a and bloqueado_id = p_b)
       or (bloqueador_id = p_b and bloqueado_id = p_a)
  );
$$;

revoke all on function public.esta_bloqueado(uuid, uuid) from public;
grant execute on function public.esta_bloqueado(uuid, uuid) to authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. RGPD: borrado definitivo de la propia cuenta
--    Borra de auth.users; profiles y todo lo demás cae en cascada.
-- ────────────────────────────────────────────────────────────

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'no_autenticado' using errcode = 'P0001';
  end if;
  -- ON DELETE CASCADE desde auth.users → profiles → posts, comentarios,
  -- mensajes, bloqueos, etc. Borrado irreversible.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
