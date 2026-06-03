-- ============================================================================
-- BLaP + Competencias + Avatar (esquema de gamificación del perfil)
--
-- BLaP = Badges · Leadership · Achievement · Points
--   · Points (P)      → capital en 3 ejes (KOI/PAI/POL). Fuente de verdad:
--                       tabla `contribuciones` (ya existe). Aquí materializamos
--                       el total por eje en `profiles` para rankings rápidos.
--   · Achievement (A) → hitos/logros con criterio y progreso.
--   · Badges (B)      → insignias mostrables que se otorgan (a veces al
--                       cumplir un logro).
--   · Leadership (L)  → carrera (cursus honorum) + roles de responsabilidad
--                       (moderación, consejería de barrio, arconte…).
--
-- Skills = competencias acreditadas (oficios/habilidades que otros avalan).
--
-- DISEÑO:
--   · Idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
--   · Los catálogos (roles, logros, insignias, competencias) son de lectura
--     pública y escritura solo admin.
--   · Las concesiones al usuario (grados, roles, logros, insignias) las otorga
--     el SISTEMA (admin / funciones SECURITY DEFINER), nunca el propio usuario.
--   · Las competencias SÍ las declara el usuario, y otros las avalan.
--
-- PENDIENTE (no en esta migración, por requerir reconciliación aparte):
--   · Recalcular cap_koi/cap_pai/cap_pol: se hace en la app (lib/capital ya
--     tiene la fórmula con pesos por sección). No lo replicamos en SQL para
--     evitar duplicar lógica y que derive. Ver TODO al final.
--   · Vista de "PEC recibidos": las tablas de PEC (pecs, agora_pecs_hilo,
--     agora_pecs_comentario, logos_pecs) tienen esquemas distintos; se
--     unificará en su propia migración.
-- ============================================================================

-- ───────────────────────── P — POINTS + Avatar ─────────────────────────────
-- Capital materializado por eje + grado cacheado + receta del avatar pixel-art.
alter table public.profiles add column if not exists cap_koi integer not null default 0;
alter table public.profiles add column if not exists cap_pai integer not null default 0;
alter table public.profiles add column if not exists cap_pol integer not null default 0;
alter table public.profiles add column if not exists grado_id text;        -- p.ej. 'polites'
alter table public.profiles add column if not exists avatar_receta jsonb;  -- preset pixel-art

-- Índice para rankings por capital total (suma de los 3 ejes).
create index if not exists idx_profiles_capital
  on public.profiles ((cap_koi + cap_pai + cap_pol) desc);

-- ───────────────────────── L — LEADERSHIP: cursus ──────────────────────────
-- Historial de grados del cursus honorum (Polítes→Árchon). El grado vigente
-- también se cachea en profiles.grado_id; aquí guardamos los ascensos.
create table if not exists public.user_grados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  grado_id    text not null,                 -- id del grado en lib/cursus
  otorgado_en timestamptz not null default now(),
  vigente     boolean not null default true,
  nota        text
);
create index if not exists idx_user_grados_user on public.user_grados(user_id);

-- ───────────────────── L — LEADERSHIP: roles/cargos ────────────────────────
-- Catálogo de roles de responsabilidad (rotatorios/revocables) con ámbito.
create table if not exists public.roles (
  id            text primary key,            -- 'moderador_seccion', 'arconte'…
  nombre        text not null,
  descripcion   text,
  ambito        text not null default 'global'
                check (ambito in ('global','isla','municipio','barrio','seccion')),
  grado_minimo  text,                        -- grado del cursus requerido
  electivo      boolean not null default false,
  creado        timestamptz not null default now()
);

-- Asignación de un rol a un usuario sobre un ámbito concreto.
create table if not exists public.user_roles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  rol_id       text not null references public.roles(id) on delete cascade,
  ambito_ref   text,                         -- p.ej. barrio_id o id de sección
  otorgado_en  timestamptz not null default now(),
  otorgado_por uuid references auth.users(id) on delete set null,
  vence_en     timestamptz,                  -- null = sin caducidad
  vigente      boolean not null default true
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create unique index if not exists uq_user_roles
  on public.user_roles(user_id, rol_id, coalesce(ambito_ref,''));

-- ───────────────────────── A — ACHIEVEMENT: logros ─────────────────────────
-- Catálogo de logros con criterio (regla en jsonb) y bonus opcional.
create table if not exists public.logros (
  id            text primary key,            -- 'primer_hilo', 'diez_pec'…
  nombre        text not null,
  descripcion   text,
  icono         text,
  eje           text check (eje in ('koinonia','paideia','politeia')),
  criterio      jsonb not null default '{}'::jsonb,  -- regla evaluable en app
  puntos_bonus  integer not null default 0,
  orden         integer not null default 0,
  creado        timestamptz not null default now()
);

-- Progreso/consecución de logros por usuario.
create table if not exists public.user_logros (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  logro_id     text not null references public.logros(id) on delete cascade,
  progreso     integer not null default 0,   -- 0..100
  conseguido_en timestamptz,                  -- null = en progreso
  unique (user_id, logro_id)
);
create index if not exists idx_user_logros_user on public.user_logros(user_id);

-- ───────────────────────── B — BADGES: insignias ───────────────────────────
-- Catálogo de insignias mostrables. Una insignia puede concederse al cumplir
-- un logro (logro_id) o por decisión manual.
create table if not exists public.insignias (
  id          text primary key,              -- 'fundador', 'vecino_activo'…
  nombre      text not null,
  descripcion text,
  icono       text,
  rareza      text not null default 'comun'
              check (rareza in ('comun','rara','epica','legendaria')),
  logro_id    text references public.logros(id) on delete set null,
  creado      timestamptz not null default now()
);

-- Insignias que tiene cada usuario; `destacada` = mostrada en su perfil.
create table if not exists public.user_insignias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  insignia_id text not null references public.insignias(id) on delete cascade,
  otorgada_en timestamptz not null default now(),
  destacada   boolean not null default false,
  unique (user_id, insignia_id)
);
create index if not exists idx_user_insignias_user on public.user_insignias(user_id);

-- ───────────────────── SKILLS — competencias acreditadas ───────────────────
-- Catálogo de competencias/oficios.
create table if not exists public.competencias (
  id          text primary key,              -- 'electricidad', 'mediacion'…
  nombre      text not null,
  categoria   text,
  descripcion text,
  creado      timestamptz not null default now()
);

-- Competencias que declara un usuario, con nivel de acreditación.
create table if not exists public.user_competencias (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  competencia_id text not null references public.competencias(id) on delete cascade,
  nivel          text not null default 'declarada'
                 check (nivel in ('declarada','avalada','acreditada')),
  avales_count   integer not null default 0,  -- denormalizado para lectura
  declarada_en   timestamptz not null default now(),
  unique (user_id, competencia_id)
);
create index if not exists idx_user_competencias_user on public.user_competencias(user_id);

-- Avales de competencia (como los PEC, pero para oficios): otra persona
-- respalda la competencia declarada por alguien.
create table if not exists public.avales_competencia (
  id                 uuid primary key default gen_random_uuid(),
  user_competencia_id uuid not null references public.user_competencias(id) on delete cascade,
  avalador_id        uuid not null references auth.users(id) on delete cascade,
  comentario         text,
  creado             timestamptz not null default now(),
  unique (user_competencia_id, avalador_id)
);
create index if not exists idx_avales_uc on public.avales_competencia(user_competencia_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.user_grados        enable row level security;
alter table public.roles              enable row level security;
alter table public.user_roles         enable row level security;
alter table public.logros             enable row level security;
alter table public.user_logros        enable row level security;
alter table public.insignias          enable row level security;
alter table public.user_insignias     enable row level security;
alter table public.competencias       enable row level security;
alter table public.user_competencias  enable row level security;
alter table public.avales_competencia enable row level security;

-- Helper inline para admin: profiles.is_admin del usuario actual.
-- (Se usa como subconsulta en las políticas de escritura de catálogos.)

-- ── Catálogos: lectura pública, escritura solo admin ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['roles','logros','insignias','competencias'] loop
    execute format('drop policy if exists "%1$s_select_public" on public.%1$s', t);
    execute format(
      'create policy "%1$s_select_public" on public.%1$s for select using (true)', t);
    execute format('drop policy if exists "%1$s_admin_write" on public.%1$s', t);
    execute format(
      'create policy "%1$s_admin_write" on public.%1$s for all
         using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
         with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))',
      t);
  end loop;
end $$;

-- ── Concesiones (grados/roles/logros/insignias): lectura si el perfil es
--    público o es el propio; escritura solo admin (el sistema otorga). ───────
do $$
declare t text;
begin
  foreach t in array array['user_grados','user_roles','user_logros','user_insignias'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format(
      'create policy "%1$s_select" on public.%1$s for select using (
         exists (select 1 from public.profiles p
                 where p.id = %1$s.user_id and (p.is_public or p.id = auth.uid())))',
      t);
    execute format('drop policy if exists "%1$s_admin_write" on public.%1$s', t);
    execute format(
      'create policy "%1$s_admin_write" on public.%1$s for all
         using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
         with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))',
      t);
  end loop;
end $$;

-- Excepción: el usuario puede ACTUALIZAR sus propias insignias (p.ej. marcar
-- cuáles destaca en su perfil), pero no insertarlas/borrarlas.
drop policy if exists "user_insignias_update_own" on public.user_insignias;
create policy "user_insignias_update_own" on public.user_insignias
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Competencias del usuario: lectura pública/propia; el usuario gestiona
--    las suyas. ───────────────────────────────────────────────────────────
drop policy if exists "user_competencias_select" on public.user_competencias;
create policy "user_competencias_select" on public.user_competencias for select using (
  exists (select 1 from public.profiles p
          where p.id = user_competencias.user_id and (p.is_public or p.id = auth.uid())));

drop policy if exists "user_competencias_write_own" on public.user_competencias;
create policy "user_competencias_write_own" on public.user_competencias
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Avales de competencia: lectura pública; insertar/borrar el aval propio,
--    pero NO avalarte a ti mismo. ─────────────────────────────────────────
drop policy if exists "avales_select" on public.avales_competencia;
create policy "avales_select" on public.avales_competencia for select using (true);

drop policy if exists "avales_insert_own" on public.avales_competencia;
create policy "avales_insert_own" on public.avales_competencia for insert
  with check (
    avalador_id = auth.uid()
    and not exists (
      select 1 from public.user_competencias uc
      where uc.id = avales_competencia.user_competencia_id and uc.user_id = auth.uid()
    )
  );

drop policy if exists "avales_delete_own" on public.avales_competencia;
create policy "avales_delete_own" on public.avales_competencia for delete
  using (avalador_id = auth.uid());

-- ── Mantener user_competencias.avales_count al día ─────────────────────────
create or replace function public.sync_avales_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.user_competencias
       set avales_count = avales_count + 1
     where id = new.user_competencia_id;
  elsif (tg_op = 'DELETE') then
    update public.user_competencias
       set avales_count = greatest(0, avales_count - 1)
     where id = old.user_competencia_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_sync_avales_count on public.avales_competencia;
create trigger trg_sync_avales_count
  after insert or delete on public.avales_competencia
  for each row execute function public.sync_avales_count();

-- ============================================================================
-- TODO (próximas migraciones / trabajo de app):
--   1. recompute_capital(user_id): recalcular cap_koi/cap_pai/cap_pol desde
--      `contribuciones` usando la fórmula de lib/capital (mejor en server
--      action al escribir una contribución, para no duplicar pesos en SQL).
--   2. recompute_grado(user_id): fijar profiles.grado_id e insertar en
--      user_grados al cruzar un umbral del cursus.
--   3. v_pecs_recibidos: vista unificada de PEC recibidos por autor, tras
--      reconciliar pecs / agora_pecs_* / logos_pecs.
--   4. Seed de catálogos: roles, logros, insignias y competencias iniciales.
-- ============================================================================
