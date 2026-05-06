-- ============================================================
-- OCRE: Solicitudes de consultoría
-- Migración: 20260506130000_consultorias.sql
-- Descripción: Tabla pública para recibir solicitudes desde el
--   formulario en /consultorias. Cualquier visitante puede INSERT
--   (sin auth requerida); solo administradores pueden SELECT/UPDATE.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Tabla: consultoria_solicitudes
-- ────────────────────────────────────────────────────────────

create table consultoria_solicitudes (
  id uuid primary key default gen_random_uuid(),

  -- Identidad del solicitante
  nombre text not null check (length(nombre) between 2 and 200),
  email text not null check (
    length(email) between 5 and 320
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),

  -- Cuerpo de la consulta
  asunto text not null check (length(asunto) between 5 and 200),
  introduccion text not null check (length(introduccion) between 30 and 7500),
  outcome text not null check (length(outcome) between 30 and 3750),

  -- Archivos adjuntos: array de paths en el bucket consultoria-uploads
  -- Cada path es del estilo: <solicitud_id>/<filename>
  archivos_paths text[] default '{}',

  -- Suscripción al boletín
  suscribir_boletin boolean default false,

  -- Estado del flujo (pendiente → en_revision → respondida → cerrada)
  estado text default 'pendiente' check (
    estado in ('pendiente', 'en_revision', 'respondida', 'cerrada', 'spam')
  ),

  -- Notas internas del equipo (no visibles al solicitante)
  notas_internas text,

  -- Auditoría
  ip_origen inet,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger consultoria_solicitudes_updated_at
  before update on consultoria_solicitudes
  for each row execute function update_updated_at_column();

create index consultoria_solicitudes_estado_idx
  on consultoria_solicitudes (estado, created_at desc);

create index consultoria_solicitudes_email_idx
  on consultoria_solicitudes (email);


-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────

alter table consultoria_solicitudes enable row level security;

-- Cualquier visitante (rol anon) puede INSERTAR una solicitud.
-- No puede leer ninguna fila — ni la suya propia (no hay sesión),
-- ni la de otros.
create policy "anon_insert_consultoria"
  on consultoria_solicitudes
  for insert
  to anon, authenticated
  with check (true);

-- Solo administradores ven y modifican solicitudes.
-- Reutilizamos la columna profiles.is_admin del schema inicial.
create policy "admin_full_access_consultoria"
  on consultoria_solicitudes
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );


-- ────────────────────────────────────────────────────────────
-- Storage bucket para adjuntos de la consultoría
-- ────────────────────────────────────────────────────────────
-- Nota: la creación del bucket vía SQL requiere extensión específica
-- de Supabase. Si esta sentencia falla en el entorno local, créese
-- desde el dashboard:
--   Storage → New bucket → name "consultoria-uploads"
--   public = false
--   allowed mime types: application/pdf, image/jpeg, image/png, image/webp
--   max file size: 10 MB

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultoria-uploads',
  'consultoria-uploads',
  false,
  10485760, -- 10 MB
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ────────────────────────────────────────────────────────────
-- Storage policies: anon puede subir, solo admin puede leer
-- ────────────────────────────────────────────────────────────

-- Cualquier visitante puede subir al bucket consultoria-uploads.
-- Limitamos a 5 archivos como máximo por solicitud a nivel UI;
-- en la base de datos solo limitamos tamaño y mime.
create policy "anon_upload_consultoria"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'consultoria-uploads');

-- Solo administradores pueden leer los archivos subidos.
create policy "admin_read_consultoria"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'consultoria-uploads'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

create policy "admin_delete_consultoria"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'consultoria-uploads'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
