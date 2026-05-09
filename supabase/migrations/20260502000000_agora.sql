-- ============================================================
-- DEMOS iOS / OCRE: Esquema Ágora (foro cívico híbrido)
-- Migración: 20260502000000_agora.sql
-- Descripción:
--   Tablas para el módulo Ágora: hilos anclados a sección PHAROS,
--   categoría local y territorio (isla/municipio/barrio); modos
--   debate / propuesta_decidim / consenso_polis; comentarios
--   anidados; PECs; decisiones binarias; propuestas Polis-style
--   con voto ternario.
-- Especificación: docs/AGORA-DATA-MODEL.md
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Tipos enumerados
-- ────────────────────────────────────────────────────────────

create type agora_modo as enum ('debate', 'propuesta_decidim', 'consenso_polis');
create type agora_estado as enum ('abierto', 'archivado', 'cerrado');
create type agora_voto_binario as enum ('a_favor', 'en_contra', 'abstencion');
create type agora_voto_ternario as enum ('de_acuerdo', 'desacuerdo', 'pasar');
create type agora_resultado as enum ('aprobada', 'rechazada', 'sin_quorum', 'empate');


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_hilos
-- Estado raíz de un hilo, sea cual sea su modo.
-- Anclaje obligatorio a sección PHAROS, opcional a categoría
-- local y territorio (isla/municipio/barrio). Las tres últimas
-- son slugs textuales validados en aplicación contra los
-- catálogos en src/lib/pharos/ y src/lib/territorio/.
-- ────────────────────────────────────────────────────────────

create table agora_hilos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references profiles(id) on delete cascade not null,
  titulo text not null check (length(titulo) between 6 and 160),
  cuerpo text not null check (length(cuerpo) between 1 and 4000),
  seccion_pharos text not null,
  categoria_local text,
  isla_id text,
  municipio_id text,
  barrio_id text,
  modo agora_modo not null default 'debate',
  estado agora_estado not null default 'abierto',
  fijado boolean not null default false,
  pec_count integer not null default 0,
  comentario_count integer not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  -- Coherencia territorial: si hay barrio_id debe haber municipio_id y isla_id;
  -- si hay municipio_id debe haber isla_id.
  check (barrio_id is null or municipio_id is not null),
  check (municipio_id is null or isla_id is not null)
);

create trigger agora_hilos_actualizado
  before update on agora_hilos
  for each row execute function update_updated_at_column();

-- Bumpa "actualizado" del hilo cuando se inserta un comentario o PEC.
-- Nota: el updated_at_column estándar mira NEW.updated_at; aquí necesitamos
-- escribir en otra tabla, así que definimos una función específica.
create or replace function bump_hilo_actualizado()
returns trigger as $$
begin
  update agora_hilos set actualizado = now() where id = new.hilo_id;
  return new;
end;
$$ language plpgsql;


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_comentarios
-- Comentarios anidados al estilo Reddit: parent_id auto-ref.
-- ────────────────────────────────────────────────────────────

create table agora_comentarios (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid references agora_hilos(id) on delete cascade not null,
  parent_id uuid references agora_comentarios(id) on delete cascade,
  autor_id uuid references profiles(id) on delete cascade not null,
  cuerpo text not null check (length(cuerpo) between 1 and 2000),
  pec_count integer not null default 0,
  creado timestamptz not null default now()
);

-- Mantén comentario_count del hilo y bumpa actualizado.
create or replace function agora_on_comentario_inserted()
returns trigger as $$
begin
  update agora_hilos
     set comentario_count = comentario_count + 1,
         actualizado = now()
   where id = new.hilo_id;
  return new;
end;
$$ language plpgsql;

create or replace function agora_on_comentario_deleted()
returns trigger as $$
begin
  update agora_hilos
     set comentario_count = greatest(comentario_count - 1, 0)
   where id = old.hilo_id;
  return old;
end;
$$ language plpgsql;

create trigger agora_comentarios_after_insert
  after insert on agora_comentarios
  for each row execute function agora_on_comentario_inserted();

create trigger agora_comentarios_after_delete
  after delete on agora_comentarios
  for each row execute function agora_on_comentario_deleted();


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_pecs_hilo
-- Respaldo encarnado a un hilo (mismo concepto que pecs en FEED).
-- ────────────────────────────────────────────────────────────

create table agora_pecs_hilo (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid references agora_hilos(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  creado timestamptz not null default now(),
  unique (hilo_id, user_id)
);

create or replace function agora_on_pec_hilo_inserted()
returns trigger as $$
begin
  update agora_hilos
     set pec_count = pec_count + 1,
         actualizado = now()
   where id = new.hilo_id;
  return new;
end;
$$ language plpgsql;

create or replace function agora_on_pec_hilo_deleted()
returns trigger as $$
begin
  update agora_hilos
     set pec_count = greatest(pec_count - 1, 0)
   where id = old.hilo_id;
  return old;
end;
$$ language plpgsql;

create trigger agora_pecs_hilo_after_insert
  after insert on agora_pecs_hilo
  for each row execute function agora_on_pec_hilo_inserted();

create trigger agora_pecs_hilo_after_delete
  after delete on agora_pecs_hilo
  for each row execute function agora_on_pec_hilo_deleted();


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_pecs_comentario
-- Respaldo encarnado a un comentario.
-- ────────────────────────────────────────────────────────────

create table agora_pecs_comentario (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid references agora_comentarios(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  creado timestamptz not null default now(),
  unique (comentario_id, user_id)
);

create or replace function agora_on_pec_comentario_inserted()
returns trigger as $$
begin
  update agora_comentarios
     set pec_count = pec_count + 1
   where id = new.comentario_id;
  return new;
end;
$$ language plpgsql;

create or replace function agora_on_pec_comentario_deleted()
returns trigger as $$
begin
  update agora_comentarios
     set pec_count = greatest(pec_count - 1, 0)
   where id = old.comentario_id;
  return old;
end;
$$ language plpgsql;

create trigger agora_pecs_comentario_after_insert
  after insert on agora_pecs_comentario
  for each row execute function agora_on_pec_comentario_inserted();

create trigger agora_pecs_comentario_after_delete
  after delete on agora_pecs_comentario
  for each row execute function agora_on_pec_comentario_deleted();


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_decisiones (modo Decidim)
-- Una sola decisión por hilo; binaria + abstención; con cierre.
-- ────────────────────────────────────────────────────────────

create table agora_decisiones (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid references agora_hilos(id) on delete cascade not null unique,
  texto text not null check (length(texto) between 1 and 1000),
  fundamentacion text check (length(fundamentacion) <= 4000),
  fecha_cierre timestamptz not null,
  quorum_minimo integer check (quorum_minimo is null or quorum_minimo >= 0),
  resultado agora_resultado,
  creado timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_votos_decision
-- ────────────────────────────────────────────────────────────

create table agora_votos_decision (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid references agora_decisiones(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  voto agora_voto_binario not null,
  creado timestamptz not null default now(),
  unique (decision_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_propuestas (modo Polis)
-- Microfrases votables generadas dentro de un hilo Polis-style.
-- ────────────────────────────────────────────────────────────

create table agora_propuestas (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid references agora_hilos(id) on delete cascade not null,
  autor_id uuid references profiles(id) on delete cascade not null,
  texto text not null check (length(texto) between 8 and 280),
  aprobada_para_votar boolean not null default true,
  creado timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: agora_votos_propuesta
-- Voto ternario sobre una propuesta Polis-style.
-- ────────────────────────────────────────────────────────────

create table agora_votos_propuesta (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid references agora_propuestas(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  voto agora_voto_ternario not null,
  creado timestamptz not null default now(),
  unique (propuesta_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- Índices de rendimiento
-- ────────────────────────────────────────────────────────────

-- Listados por sección (la consulta más común)
create index idx_agora_hilos_seccion_actualizado
  on agora_hilos(seccion_pharos, actualizado desc)
  where estado = 'abierto';

create index idx_agora_hilos_seccion_creado
  on agora_hilos(seccion_pharos, creado desc)
  where estado = 'abierto';

create index idx_agora_hilos_seccion_pec
  on agora_hilos(seccion_pharos, pec_count desc, creado desc)
  where estado = 'abierto';

-- Filtros adicionales
create index idx_agora_hilos_categoria on agora_hilos(categoria_local) where categoria_local is not null;
create index idx_agora_hilos_isla on agora_hilos(isla_id) where isla_id is not null;
create index idx_agora_hilos_municipio on agora_hilos(municipio_id) where municipio_id is not null;
create index idx_agora_hilos_barrio on agora_hilos(barrio_id) where barrio_id is not null;
create index idx_agora_hilos_autor on agora_hilos(autor_id);
create index idx_agora_hilos_modo on agora_hilos(modo);
create index idx_agora_hilos_fijado on agora_hilos(seccion_pharos) where fijado = true;

-- Comentarios
create index idx_agora_comentarios_hilo on agora_comentarios(hilo_id, creado);
create index idx_agora_comentarios_parent on agora_comentarios(parent_id) where parent_id is not null;
create index idx_agora_comentarios_autor on agora_comentarios(autor_id);

-- PECs
create index idx_agora_pecs_hilo_hilo on agora_pecs_hilo(hilo_id);
create index idx_agora_pecs_hilo_user on agora_pecs_hilo(user_id);
create index idx_agora_pecs_comentario_com on agora_pecs_comentario(comentario_id);
create index idx_agora_pecs_comentario_user on agora_pecs_comentario(user_id);

-- Decisiones y votos
create index idx_agora_decisiones_cierre on agora_decisiones(fecha_cierre);
create index idx_agora_votos_decision_decision on agora_votos_decision(decision_id);
create index idx_agora_votos_decision_user on agora_votos_decision(user_id);

-- Propuestas Polis
create index idx_agora_propuestas_hilo on agora_propuestas(hilo_id, creado);
create index idx_agora_votos_propuesta_propuesta on agora_votos_propuesta(propuesta_id);
create index idx_agora_votos_propuesta_user on agora_votos_propuesta(user_id);


-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────

alter table agora_hilos enable row level security;
alter table agora_comentarios enable row level security;
alter table agora_pecs_hilo enable row level security;
alter table agora_pecs_comentario enable row level security;
alter table agora_decisiones enable row level security;
alter table agora_votos_decision enable row level security;
alter table agora_propuestas enable row level security;
alter table agora_votos_propuesta enable row level security;

-- ----- agora_hilos -----
-- Lectura pública (excepto autores shadow-banned, salvo el propio autor o admin).
create policy "agora_hilos_select_public"
  on agora_hilos for select
  using (
    not is_shadow_banned(autor_id)
    or autor_id = auth.uid()
    or is_admin()
  );

create policy "agora_hilos_insert_auth"
  on agora_hilos for insert
  with check (autor_id = auth.uid());

create policy "agora_hilos_update_own"
  on agora_hilos for update
  using (autor_id = auth.uid() or is_admin())
  with check (autor_id = auth.uid() or is_admin());

create policy "agora_hilos_delete_own"
  on agora_hilos for delete
  using (autor_id = auth.uid() or is_admin());

-- ----- agora_comentarios -----
create policy "agora_comentarios_select_public"
  on agora_comentarios for select
  using (
    not is_shadow_banned(autor_id)
    or autor_id = auth.uid()
    or is_admin()
  );

create policy "agora_comentarios_insert_auth"
  on agora_comentarios for insert
  with check (autor_id = auth.uid());

create policy "agora_comentarios_update_own"
  on agora_comentarios for update
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create policy "agora_comentarios_delete_own"
  on agora_comentarios for delete
  using (autor_id = auth.uid() or is_admin());

-- ----- PECs (lectura pública para conteos) -----
create policy "agora_pecs_hilo_select_public" on agora_pecs_hilo for select using (true);
create policy "agora_pecs_hilo_insert_auth" on agora_pecs_hilo for insert with check (user_id = auth.uid());
create policy "agora_pecs_hilo_delete_own" on agora_pecs_hilo for delete using (user_id = auth.uid());

create policy "agora_pecs_comentario_select_public" on agora_pecs_comentario for select using (true);
create policy "agora_pecs_comentario_insert_auth" on agora_pecs_comentario for insert with check (user_id = auth.uid());
create policy "agora_pecs_comentario_delete_own" on agora_pecs_comentario for delete using (user_id = auth.uid());

-- ----- agora_decisiones -----
-- La decisión la crea el autor del hilo o un admin.
-- (El gating por grado cursus se aplica en el server action antes de insertar.)
create policy "agora_decisiones_select_public" on agora_decisiones for select using (true);

create policy "agora_decisiones_insert_author"
  on agora_decisiones for insert
  with check (
    exists (
      select 1 from agora_hilos h
      where h.id = agora_decisiones.hilo_id
        and (h.autor_id = auth.uid() or is_admin())
    )
  );

create policy "agora_decisiones_update_admin"
  on agora_decisiones for update
  using (is_admin())
  with check (is_admin());

-- ----- agora_votos_decision -----
create policy "agora_votos_decision_select_public" on agora_votos_decision for select using (true);
create policy "agora_votos_decision_insert_auth" on agora_votos_decision for insert with check (user_id = auth.uid());
create policy "agora_votos_decision_update_own" on agora_votos_decision for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agora_votos_decision_delete_own" on agora_votos_decision for delete using (user_id = auth.uid());

-- ----- agora_propuestas -----
create policy "agora_propuestas_select_public"
  on agora_propuestas for select
  using (
    aprobada_para_votar = true
    or autor_id = auth.uid()
    or is_admin()
  );

create policy "agora_propuestas_insert_auth"
  on agora_propuestas for insert
  with check (autor_id = auth.uid());

create policy "agora_propuestas_update_admin"
  on agora_propuestas for update
  using (is_admin() or autor_id = auth.uid())
  with check (is_admin() or autor_id = auth.uid());

create policy "agora_propuestas_delete_own"
  on agora_propuestas for delete
  using (autor_id = auth.uid() or is_admin());

-- ----- agora_votos_propuesta -----
create policy "agora_votos_propuesta_select_public" on agora_votos_propuesta for select using (true);
create policy "agora_votos_propuesta_insert_auth" on agora_votos_propuesta for insert with check (user_id = auth.uid());
create policy "agora_votos_propuesta_update_own" on agora_votos_propuesta for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agora_votos_propuesta_delete_own" on agora_votos_propuesta for delete using (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- Anti-spam: limita la frecuencia de creación de hilos y
-- comentarios por usuario. Lanzar un error elegante (P0001).
-- ────────────────────────────────────────────────────────────

create or replace function agora_check_rate_limit_hilo()
returns trigger as $$
declare
  cnt integer;
begin
  select count(*) into cnt
    from agora_hilos
   where autor_id = new.autor_id
     and creado > now() - interval '24 hours';
  if cnt >= 5 then
    raise exception 'limite_hilos_diario'
      using errcode = 'P0001',
            hint = 'Has creado 5 hilos en las últimas 24h. Tomate un café y vuelve mañana.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger agora_hilos_rate_limit
  before insert on agora_hilos
  for each row execute function agora_check_rate_limit_hilo();

create or replace function agora_check_rate_limit_comentario()
returns trigger as $$
declare
  cnt integer;
begin
  select count(*) into cnt
    from agora_comentarios
   where autor_id = new.autor_id
     and creado > now() - interval '1 hour';
  if cnt >= 30 then
    raise exception 'limite_comentarios_horario'
      using errcode = 'P0001',
            hint = 'Has comentado 30 veces en la última hora. Respira.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger agora_comentarios_rate_limit
  before insert on agora_comentarios
  for each row execute function agora_check_rate_limit_comentario();
