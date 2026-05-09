-- ============================================================
-- KOINOS: Esquema inicial de base de datos
-- Migración: 20260413000000_initial_schema.sql
-- Descripción: Tablas principales para TOUCH, FEED y POLIS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Tipos enumerados
-- ────────────────────────────────────────────────────────────

-- Estado semáforo del usuario (verde = disponible, amarillo = ocupado, rojo = no molestar)
create type sem_status as enum ('green', 'yellow', 'red');

-- Razones de reporte para moderación
create type report_reason as enum ('spam', 'harassment', 'hate', 'misinformation', 'other');

-- Estado del reporte en el flujo de moderación
create type report_status as enum ('pending', 'reviewing', 'resolved', 'dismissed');

-- Tipos de skin para publicaciones
create type post_skin as enum ('plain', 'yapper', 'devlog', 'nature', 'photo');

-- Tipos de media adjunto
create type media_kind as enum ('image', 'document', 'video');

-- Tipos de contenido de álbum
create type album_kind as enum ('photo', 'video');


-- ────────────────────────────────────────────────────────────
-- Función para actualizar updated_at automáticamente
-- ────────────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ────────────────────────────────────────────────────────────
-- Tabla: profiles
-- Perfiles de usuario vinculados a auth.users de Supabase
-- ────────────────────────────────────────────────────────────

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  handle text unique not null check (length(handle) between 3 and 30),
  display_name text,
  avatar_url text,
  bio text check (length(bio) <= 300),
  interests text[] default '{}',
  sem sem_status default 'green',
  invitation_code text,
  invited_by uuid references profiles(id) on delete set null,
  is_shadow_banned boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- Tabla: posts
-- Publicaciones del FEED social
-- ────────────────────────────────────────────────────────────

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade not null,
  text text not null check (length(text) <= 2000),
  image_url text,
  video_url text,
  skin post_skin default 'plain',
  is_ai boolean default false,
  ai_label text,
  -- Campos de cita incrustada (cuando el post incluye una cita)
  cita_text text,
  cita_author text,
  cita_source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at_column();


-- ────────────────────────────────────────────────────────────
-- Tabla: comments
-- Comentarios con hilos anidados (estilo Reddit)
-- parent_id permite respuestas a otros comentarios
-- ────────────────────────────────────────────────────────────

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  parent_id uuid references comments(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade not null,
  text text not null check (length(text) <= 1000),
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: likes
-- "Me gusta" anónimo (+1 sin identidad visible)
-- ────────────────────────────────────────────────────────────

create table likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- Tabla: pecs
-- PEC = respaldo encarnado (tu avatar aparece en el post)
-- Diferente de like: es público y visible quién respalda
-- ────────────────────────────────────────────────────────────

create table pecs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- Tabla: follows
-- Relaciones de seguimiento entre usuarios
-- Red cerrada para TOUCH/POLIS, abierta para FEED
-- ────────────────────────────────────────────────────────────

create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);


-- ────────────────────────────────────────────────────────────
-- Tabla: album_items
-- Contenido guardado en TOUCH (álbum privado)
-- ────────────────────────────────────────────────────────────

create table album_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  kind album_kind not null,
  storage_path text not null,
  caption text check (length(caption) <= 500),
  source_post_id uuid references posts(id) on delete set null,
  duration_sec integer,
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: post_media
-- Archivos adjuntos a publicaciones (múltiples por post)
-- ────────────────────────────────────────────────────────────

create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  kind media_kind not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  position integer default 0,
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: citas
-- Base de datos de citas para el randomizador
-- ────────────────────────────────────────────────────────────

create table citas (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text not null,
  source text,
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: yappers
-- Personajes históricos de IA que publican contenido
-- ────────────────────────────────────────────────────────────

create table yappers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text unique not null,
  era text,
  bio text,
  avatar_url text,
  personality_prompt text,
  is_active boolean default true,
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: reports
-- Sistema de reportes para moderación comunitaria
-- Exactamente uno de los tres campos reported_* debe ser no nulo
-- ────────────────────────────────────────────────────────────

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade not null,
  reported_post_id uuid references posts(id) on delete cascade,
  reported_comment_id uuid references comments(id) on delete cascade,
  reported_user_id uuid references profiles(id) on delete set null,
  reason report_reason not null,
  details text,
  status report_status default 'pending',
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  -- Restricción: exactamente un objetivo por reporte
  check (
    (reported_post_id is not null)::int +
    (reported_comment_id is not null)::int +
    (reported_user_id is not null)::int = 1
  )
);


-- ────────────────────────────────────────────────────────────
-- Tabla: invitations
-- Sistema de invitaciones para crecimiento controlado
-- ────────────────────────────────────────────────────────────

create table invitations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references profiles(id) on delete cascade not null,
  used_by uuid references profiles(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- Tabla: waitlist
-- Lista de espera para acceso anticipado
-- ────────────────────────────────────────────────────────────

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);
