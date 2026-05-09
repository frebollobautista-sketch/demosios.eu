-- ============================================================
-- DEMOS iOS / OCRE: Esquema Lógos (sub-página de Ágora · palabra)
-- Migración: 20260503000000_logos.sql
-- Descripción:
--   Persistencia mínima del sub-módulo Lógos (Λόγος) dentro de
--   la pestaña Ágora. Posts de tres tipos (texto, cita, audio),
--   PEC con dos niveles (silencioso + público), transcripción
--   automática de audio (rellenada por edge function Whisper),
--   y subposts encadenados (comentarios) que NO suben al feed.
-- Especificación: docs/AGORA-FUNCIONALIDADES.md (sección Lógos)
-- Decisiones del 2026-05-03 que materializa esta migración:
--   · PEC con dos niveles silencioso/público → tabla logos_pecs.nivel
--   · Like eliminado → ninguna tabla likes_*
--   · Comentarios como subposts encadenados → logos_comentarios
--   · Transcripción audio automática → logos_audio_transcripciones
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Tipos enumerados
-- ────────────────────────────────────────────────────────────

create type logos_post_tipo as enum ('texto', 'cita', 'audio');
create type logos_pec_nivel as enum ('silencioso', 'publico');


-- ────────────────────────────────────────────────────────────
-- Tabla: logos_posts
-- La unidad básica del sub-módulo Lógos.
-- Tres tipos de post (texto, cita, audio) con campos específicos
-- por tipo, validados con CHECK constraints.
-- ────────────────────────────────────────────────────────────

create table logos_posts (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references profiles(id) on delete cascade not null,
  tipo logos_post_tipo not null,

  -- Contenido textual.
  --  · tipo = 'texto'  → cuerpo es el post completo (1..500 chars)
  --  · tipo = 'cita'   → cuerpo es el texto de la cita (1..280 chars)
  --  · tipo = 'audio'  → cuerpo es la caption opcional (0..500 chars)
  cuerpo text,

  -- Específicos de tipo = 'cita'
  cita_autor text check (cita_autor is null or length(cita_autor) between 1 and 200),
  cita_fuente text check (cita_fuente is null or length(cita_fuente) between 1 and 300),

  -- Específicos de tipo = 'audio'
  audio_url text,                    -- ruta en Supabase Storage
  audio_duracion_seg integer check (audio_duracion_seg is null or audio_duracion_seg between 1 and 60),

  -- Etiquetas opcionales (alineadas con Bibliotheka·debate y Polis para el cruce en "Mi Quiosco")
  seccion_pharos text,               -- slug de SECCIONES (validado en aplicación)
  isla_id text,
  municipio_id text,
  barrio_id text,

  -- Posts de IA (formato cita histórica que ya existe en el FEED actual)
  es_ai boolean not null default false,
  ai_etiqueta text,                  -- e.g. "Meditaciones, Libro III"

  -- Soft-delete: el autor retira su post pero queda placeholder
  -- "[post retirado por el autor]" y los comentarios sobreviven.
  retirado boolean not null default false,
  retirado_en timestamptz,

  -- Denormalizados para listados rápidos sin joins.
  pec_silencioso_count integer not null default 0,
  pec_publico_count integer not null default 0,
  comentario_count integer not null default 0,

  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),

  -- Coherencia jerárquica del territorio.
  check (barrio_id is null or municipio_id is not null),
  check (municipio_id is null or isla_id is not null),

  -- Coherencia por tipo de post.
  check (
    case tipo
      when 'texto' then cuerpo is not null and length(cuerpo) between 1 and 500
                       and cita_autor is null and audio_url is null
      when 'cita'  then cuerpo is not null and length(cuerpo) between 1 and 280
                       and cita_autor is not null
                       and audio_url is null
      when 'audio' then audio_url is not null
                       and audio_duracion_seg is not null
                       and (cuerpo is null or length(cuerpo) <= 500)
                       and cita_autor is null
    end
  ),

  -- Si es_ai = true, ai_etiqueta debería tener valor (recomendado).
  check (es_ai = false or ai_etiqueta is not null)
);

create trigger logos_posts_actualizado
  before update on logos_posts
  for each row execute function update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- Tabla: logos_pecs
-- PEC con DOS NIVELES:
--   · silencioso: incrementa contador, sin avatar visible
--   · publico:    incrementa contador y muestra avatar
-- Un usuario solo puede tener una fila por post; cambiar de nivel
-- requiere UPDATE (no inserciones múltiples).
-- ────────────────────────────────────────────────────────────

create table logos_pecs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references logos_posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  nivel logos_pec_nivel not null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (post_id, user_id)
);

create trigger logos_pecs_actualizado
  before update on logos_pecs
  for each row execute function update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- Tabla: logos_audio_transcripciones
-- Transcripción automática de audios vía Whisper API. Una fila
-- por post de audio. La inserción la hace una Edge Function tras
-- subir el audio (cableado en tarea posterior).
-- ────────────────────────────────────────────────────────────

create table logos_audio_transcripciones (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references logos_posts(id) on delete cascade not null unique,
  texto text not null,
  idioma text not null default 'es',
  generado_por text not null default 'whisper-1',
  confianza numeric(3, 2),               -- 0.00..1.00, opcional
  creado timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: logos_comentarios
-- Subposts encadenados que NO suben al feed principal.
-- Solo se ven al abrir el post raíz. Anidamiento por parent_id
-- auto-referencial. Decisión 2026-05-03 de la sesión.
-- ────────────────────────────────────────────────────────────

create table logos_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references logos_posts(id) on delete cascade not null,
  parent_id uuid references logos_comentarios(id) on delete cascade,
  autor_id uuid references profiles(id) on delete cascade not null,
  cuerpo text not null check (length(cuerpo) between 1 and 1000),
  pec_silencioso_count integer not null default 0,
  pec_publico_count integer not null default 0,
  retirado boolean not null default false,
  retirado_en timestamptz,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create trigger logos_comentarios_actualizado
  before update on logos_comentarios
  for each row execute function update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- Tabla: logos_pecs_comentario
-- Análoga a logos_pecs pero apuntando a comentarios.
-- ────────────────────────────────────────────────────────────

create table logos_pecs_comentario (
  id uuid primary key default gen_random_uuid(),
  comentario_id uuid references logos_comentarios(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  nivel logos_pec_nivel not null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (comentario_id, user_id)
);

create trigger logos_pecs_comentario_actualizado
  before update on logos_pecs_comentario
  for each row execute function update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- Triggers de denormalización
-- Mantienen los _count de logos_posts y logos_comentarios al
-- insertar/actualizar/borrar PECs y comentarios.
-- ────────────────────────────────────────────────────────────

-- Comentarios: bumpa comentario_count y actualizado del post raíz.
create or replace function logos_on_comentario_inserted()
returns trigger as $$
begin
  update logos_posts
     set comentario_count = comentario_count + 1,
         actualizado = now()
   where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create or replace function logos_on_comentario_deleted()
returns trigger as $$
begin
  update logos_posts
     set comentario_count = greatest(comentario_count - 1, 0)
   where id = old.post_id;
  return old;
end;
$$ language plpgsql;

create trigger logos_comentarios_after_insert
  after insert on logos_comentarios
  for each row execute function logos_on_comentario_inserted();

create trigger logos_comentarios_after_delete
  after delete on logos_comentarios
  for each row execute function logos_on_comentario_deleted();


-- PECs sobre post: incrementa contador correspondiente al nivel
-- y bumpa actualizado.
create or replace function logos_on_pec_post_inserted()
returns trigger as $$
begin
  if new.nivel = 'silencioso' then
    update logos_posts
       set pec_silencioso_count = pec_silencioso_count + 1,
           actualizado = now()
     where id = new.post_id;
  else
    update logos_posts
       set pec_publico_count = pec_publico_count + 1,
           actualizado = now()
     where id = new.post_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function logos_on_pec_post_deleted()
returns trigger as $$
begin
  if old.nivel = 'silencioso' then
    update logos_posts
       set pec_silencioso_count = greatest(pec_silencioso_count - 1, 0)
     where id = old.post_id;
  else
    update logos_posts
       set pec_publico_count = greatest(pec_publico_count - 1, 0)
     where id = old.post_id;
  end if;
  return old;
end;
$$ language plpgsql;

-- Cambio de nivel de PEC: descuenta del antiguo, suma al nuevo.
create or replace function logos_on_pec_post_updated()
returns trigger as $$
begin
  if old.nivel = new.nivel then
    return new;
  end if;
  if old.nivel = 'silencioso' then
    update logos_posts
       set pec_silencioso_count = greatest(pec_silencioso_count - 1, 0),
           pec_publico_count = pec_publico_count + 1,
           actualizado = now()
     where id = new.post_id;
  else
    update logos_posts
       set pec_publico_count = greatest(pec_publico_count - 1, 0),
           pec_silencioso_count = pec_silencioso_count + 1,
           actualizado = now()
     where id = new.post_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger logos_pecs_after_insert
  after insert on logos_pecs
  for each row execute function logos_on_pec_post_inserted();

create trigger logos_pecs_after_delete
  after delete on logos_pecs
  for each row execute function logos_on_pec_post_deleted();

create trigger logos_pecs_after_update
  after update on logos_pecs
  for each row execute function logos_on_pec_post_updated();


-- PECs sobre comentario: análogo, sobre logos_comentarios.
create or replace function logos_on_pec_com_inserted()
returns trigger as $$
begin
  if new.nivel = 'silencioso' then
    update logos_comentarios
       set pec_silencioso_count = pec_silencioso_count + 1
     where id = new.comentario_id;
  else
    update logos_comentarios
       set pec_publico_count = pec_publico_count + 1
     where id = new.comentario_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function logos_on_pec_com_deleted()
returns trigger as $$
begin
  if old.nivel = 'silencioso' then
    update logos_comentarios
       set pec_silencioso_count = greatest(pec_silencioso_count - 1, 0)
     where id = old.comentario_id;
  else
    update logos_comentarios
       set pec_publico_count = greatest(pec_publico_count - 1, 0)
     where id = old.comentario_id;
  end if;
  return old;
end;
$$ language plpgsql;

create or replace function logos_on_pec_com_updated()
returns trigger as $$
begin
  if old.nivel = new.nivel then
    return new;
  end if;
  if old.nivel = 'silencioso' then
    update logos_comentarios
       set pec_silencioso_count = greatest(pec_silencioso_count - 1, 0),
           pec_publico_count = pec_publico_count + 1
     where id = new.comentario_id;
  else
    update logos_comentarios
       set pec_publico_count = greatest(pec_publico_count - 1, 0),
           pec_silencioso_count = pec_silencioso_count + 1
     where id = new.comentario_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger logos_pecs_com_after_insert
  after insert on logos_pecs_comentario
  for each row execute function logos_on_pec_com_inserted();

create trigger logos_pecs_com_after_delete
  after delete on logos_pecs_comentario
  for each row execute function logos_on_pec_com_deleted();

create trigger logos_pecs_com_after_update
  after update on logos_pecs_comentario
  for each row execute function logos_on_pec_com_updated();


-- ────────────────────────────────────────────────────────────
-- Anti-spam: rate limit en posts y comentarios.
-- Defaults: 20 posts/24h, 30 comentarios/hora.
-- (La decisión final del cap diario está en docs/AGORA-FUNCIONALIDADES.md
-- pendiente nº1; estos límites blandos son razonables y se ajustan
-- cuando se cierre la decisión.)
-- ────────────────────────────────────────────────────────────

create or replace function logos_check_rate_limit_post()
returns trigger as $$
declare
  cnt integer;
begin
  select count(*) into cnt
    from logos_posts
   where autor_id = new.autor_id
     and creado > now() - interval '24 hours';
  if cnt >= 20 then
    raise exception 'limite_posts_diario'
      using errcode = 'P0001',
            hint = 'Has publicado 20 posts en las últimas 24h. Tomate un café.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger logos_posts_rate_limit
  before insert on logos_posts
  for each row execute function logos_check_rate_limit_post();

create or replace function logos_check_rate_limit_comentario()
returns trigger as $$
declare
  cnt integer;
begin
  select count(*) into cnt
    from logos_comentarios
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

create trigger logos_comentarios_rate_limit
  before insert on logos_comentarios
  for each row execute function logos_check_rate_limit_comentario();


-- ────────────────────────────────────────────────────────────
-- Índices de rendimiento
-- ────────────────────────────────────────────────────────────

-- Feed cronológico (la consulta más común)
create index idx_logos_posts_creado
  on logos_posts(creado desc)
  where retirado = false;

-- Feed por autor (perfil)
create index idx_logos_posts_autor
  on logos_posts(autor_id, creado desc);

-- Filtros opcionales
create index idx_logos_posts_seccion
  on logos_posts(seccion_pharos, creado desc)
  where seccion_pharos is not null and retirado = false;

create index idx_logos_posts_isla
  on logos_posts(isla_id) where isla_id is not null;
create index idx_logos_posts_municipio
  on logos_posts(municipio_id) where municipio_id is not null;
create index idx_logos_posts_barrio
  on logos_posts(barrio_id) where barrio_id is not null;

create index idx_logos_posts_tipo on logos_posts(tipo);
create index idx_logos_posts_es_ai on logos_posts(es_ai) where es_ai = true;

-- PECs
create index idx_logos_pecs_post on logos_pecs(post_id);
create index idx_logos_pecs_user on logos_pecs(user_id);
create index idx_logos_pecs_post_publicos
  on logos_pecs(post_id) where nivel = 'publico';

-- Comentarios
create index idx_logos_comentarios_post on logos_comentarios(post_id, creado);
create index idx_logos_comentarios_parent
  on logos_comentarios(parent_id) where parent_id is not null;
create index idx_logos_comentarios_autor on logos_comentarios(autor_id);

-- PECs sobre comentarios
create index idx_logos_pecs_com on logos_pecs_comentario(comentario_id);
create index idx_logos_pecs_com_user on logos_pecs_comentario(user_id);


-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────

alter table logos_posts enable row level security;
alter table logos_pecs enable row level security;
alter table logos_audio_transcripciones enable row level security;
alter table logos_comentarios enable row level security;
alter table logos_pecs_comentario enable row level security;

-- ----- logos_posts -----
-- Lectura pública (excepto autores shadow-banned, salvo el propio o admin).
create policy "logos_posts_select_public"
  on logos_posts for select
  using (
    not is_shadow_banned(autor_id)
    or autor_id = auth.uid()
    or is_admin()
  );

create policy "logos_posts_insert_auth"
  on logos_posts for insert
  with check (autor_id = auth.uid());

create policy "logos_posts_update_own"
  on logos_posts for update
  using (autor_id = auth.uid() or is_admin())
  with check (autor_id = auth.uid() or is_admin());

create policy "logos_posts_delete_own"
  on logos_posts for delete
  using (autor_id = auth.uid() or is_admin());

-- ----- logos_pecs -----
-- Los PECs silenciosos siguen siendo "públicos" en la base (cuentan para
-- estadísticas), pero la UI cliente nunca muestra el avatar; solo los
-- 'publico' aparecen visibles. RLS no necesita distinguir aquí.
create policy "logos_pecs_select_public" on logos_pecs for select using (true);
create policy "logos_pecs_insert_auth" on logos_pecs for insert with check (user_id = auth.uid());
create policy "logos_pecs_update_own" on logos_pecs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "logos_pecs_delete_own" on logos_pecs for delete using (user_id = auth.uid());

-- ----- logos_audio_transcripciones -----
-- Lectura pública. Solo service_role escribe (la edge function de Whisper).
create policy "logos_transcripciones_select_public"
  on logos_audio_transcripciones for select using (true);

-- (Sin policy de INSERT/UPDATE/DELETE para usuarios normales: solo
--  service_role puede tocar esta tabla, y service_role bypassea RLS.)

-- ----- logos_comentarios -----
create policy "logos_comentarios_select_public"
  on logos_comentarios for select
  using (
    not is_shadow_banned(autor_id)
    or autor_id = auth.uid()
    or is_admin()
  );

create policy "logos_comentarios_insert_auth"
  on logos_comentarios for insert
  with check (autor_id = auth.uid());

create policy "logos_comentarios_update_own"
  on logos_comentarios for update
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create policy "logos_comentarios_delete_own"
  on logos_comentarios for delete
  using (autor_id = auth.uid() or is_admin());

-- ----- logos_pecs_comentario -----
create policy "logos_pecs_com_select_public" on logos_pecs_comentario for select using (true);
create policy "logos_pecs_com_insert_auth" on logos_pecs_comentario for insert with check (user_id = auth.uid());
create policy "logos_pecs_com_update_own" on logos_pecs_comentario for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "logos_pecs_com_delete_own" on logos_pecs_comentario for delete using (user_id = auth.uid());
