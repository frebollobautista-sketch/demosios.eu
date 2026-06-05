-- ============================================================
-- OCRE: Tus datos / RGPD
-- Migración: 20260603000001_rgpd.sql
-- Descripción:
--   1. consentimientos      → registro auditable (append-only) de
--                             qué aceptó el usuario y cuándo
--   2. exportaciones_datos  → solicitudes de exportación (derecho de
--                             portabilidad). La edge function genera el
--                             archivo y manda el correo "tu exportación
--                             está lista".
--   3. eliminaciones_cuenta → solicitudes de borrado (derecho al olvido)
--                             con periodo de gracia y anonimización.
--   4. Bucket privado `exportaciones` + RLS (cada quien solo sus archivos)
--
--   Idempotente y no destructiva. Referencia profiles(id) e is_admin().
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. consentimientos  (append-only: nunca se edita ni se borra)
-- Cada fila es un evento: "el usuario otorgó/retiró el consentimiento
-- X, versión Y, en el momento Z". El RGPD exige poder demostrarlo.
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE consentimiento_tipo AS ENUM (
    'condiciones',   -- términos de uso
    'privacidad',    -- política de privacidad
    'cookies',       -- cookies no esenciales
    'boletin',       -- boletín semanal
    'barrio'         -- boletín quincenal de barrio
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tipo consentimiento_tipo NOT NULL,
  version text NOT NULL,            -- p. ej. "privacidad-2026-05"
  otorgado boolean NOT NULL,        -- true = aceptado, false = retirado
  origen text,                      -- 'registro' | 'ajustes' | 'banner_cookies'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_user_tipo
  ON consentimientos(user_id, tipo, created_at DESC);

ALTER TABLE consentimientos ENABLE ROW LEVEL SECURITY;

-- El usuario ve su propio historial
CREATE POLICY "consent_select_own"
  ON consentimientos FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- Puede registrar consentimientos propios (la app inserta un evento
-- cada vez que acepta/retira algo). Append-only: sin UPDATE ni DELETE.
CREATE POLICY "consent_insert_own"
  ON consentimientos FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 2. exportaciones_datos  (derecho de portabilidad)
-- El usuario pide su exportación → edge function (service_role) genera
-- el archivo, lo sube al bucket privado, fija archivo_path y caduca_at,
-- y manda el correo. El enlace de descarga es una signed URL temporal.
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE exportacion_estado AS ENUM (
    'pendiente',   -- recién solicitada
    'procesando',  -- la function la está generando
    'lista',       -- archivo disponible para descargar
    'caducada',    -- pasó caduca_at, archivo borrado
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS exportaciones_datos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  estado exportacion_estado NOT NULL DEFAULT 'pendiente',
  archivo_path text,                 -- ruta en el bucket (no URL pública)
  archivo_bytes bigint,
  error text,
  solicitado_at timestamptz NOT NULL DEFAULT now(),
  completado_at timestamptz,
  caduca_at timestamptz              -- la descarga expira (p. ej. +72h)
);

CREATE INDEX IF NOT EXISTS idx_export_user
  ON exportaciones_datos(user_id, solicitado_at DESC);

-- Solo UNA exportación en curso por usuario (evita abuso/coste)
CREATE UNIQUE INDEX IF NOT EXISTS idx_export_una_en_curso
  ON exportaciones_datos(user_id)
  WHERE estado IN ('pendiente', 'procesando');

ALTER TABLE exportaciones_datos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_select_own"
  ON exportaciones_datos FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- El usuario solicita la suya (estado lo fija el default = 'pendiente')
CREATE POLICY "export_insert_own"
  ON exportaciones_datos FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 3. eliminaciones_cuenta  (derecho al olvido)
-- Periodo de gracia: el usuario puede cancelar antes de ejecutar_at.
-- Modo por defecto = anonimizar (mantiene la integridad de los hilos
-- del Ágora; borra los datos personales y deja una lápida "cuenta
-- eliminada"). 'borrado_total' solo para casos que lo exijan.
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE eliminacion_estado AS ENUM (
    'solicitada',  -- en periodo de gracia
    'cancelada',   -- el usuario se arrepintió
    'completada'   -- ejecutada
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE eliminacion_modo AS ENUM ('anonimizar', 'borrado_total');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS eliminaciones_cuenta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  estado eliminacion_estado NOT NULL DEFAULT 'solicitada',
  modo eliminacion_modo NOT NULL DEFAULT 'anonimizar',
  motivo text,                       -- opcional, para mejorar (no obligatorio)
  solicitado_at timestamptz NOT NULL DEFAULT now(),
  ejecutar_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  completado_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_elim_user
  ON eliminaciones_cuenta(user_id, solicitado_at DESC);

-- Solo UNA solicitud activa por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_elim_una_activa
  ON eliminaciones_cuenta(user_id)
  WHERE estado = 'solicitada';

-- Barrido del cron: las que ya toca ejecutar
CREATE INDEX IF NOT EXISTS idx_elim_a_ejecutar
  ON eliminaciones_cuenta(ejecutar_at)
  WHERE estado = 'solicitada';

ALTER TABLE eliminaciones_cuenta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elim_select_own"
  ON eliminaciones_cuenta FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- Solicitar borrado propio (la app exige reautenticación antes de llegar aquí)
CREATE POLICY "elim_insert_own"
  ON eliminaciones_cuenta FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Cancelar dentro del periodo de gracia: solo pasar 'solicitada' → 'cancelada'
CREATE POLICY "elim_cancel_own"
  ON eliminaciones_cuenta FOR UPDATE
  USING (user_id = auth.uid() AND estado = 'solicitada')
  WITH CHECK (user_id = auth.uid() AND estado IN ('solicitada', 'cancelada'));


-- ────────────────────────────────────────────────────────────
-- 4. Bucket privado para las exportaciones + RLS
-- Estructura de rutas: exportaciones/{user_id}/{export_id}.zip
-- Cada usuario solo accede a la carpeta con su propio uid.
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('exportaciones', 'exportaciones', false)
ON CONFLICT (id) DO NOTHING;

-- Leer solo los archivos de tu propia carpeta (primer segmento = tu uid)
DROP POLICY IF EXISTS "export_files_select_own" ON storage.objects;
CREATE POLICY "export_files_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exportaciones'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
