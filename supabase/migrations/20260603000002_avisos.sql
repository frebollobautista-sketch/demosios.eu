-- ============================================================
-- OCRE: Avisos / banners dinámicos
-- Migración: 20260603000002_avisos.sql
-- Descripción:
--   1. avisos          → banners que un admin enciende/apaga SIN
--                        desplegar (mantenimiento, convocatorias, actos,
--                        beta, incidencias…)
--   2. aviso_descartes → qué avisos ha cerrado cada usuario (persiste
--                        entre dispositivos; para anónimos se usa
--                        localStorage en el cliente)
--   3. Vista avisos_visibles → ya filtra por vigencia, audiencia y
--                        descartes del usuario actual
--
--   La RLS hace todo el filtrado de visibilidad: el front solo lee la
--   vista. Solo los admins crean/editan avisos.
--   Idempotente y no destructiva. Referencia profiles(id) e is_admin().
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Tipos
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE aviso_tipo AS ENUM (
    'mantenimiento',  -- "Estaremos en mantenimiento el..."
    'incidencia',     -- algo está fallando ahora mismo
    'convocatoria',   -- llamada a participar
    'acto',           -- acto público próximo
    'votacion',       -- consulta/votación abierta en Ágora
    'beta',           -- "OCRE está en fase de invitación"
    'general'         -- nota informativa
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Severidad: controla el tratamiento visual (sobrio, sin estridencias)
--   info    → piedra / papiro
--   aviso   → ocre
--   urgente → ocre reforzado (reservado para incidencias reales)
DO $$ BEGIN
  CREATE TYPE aviso_severidad AS ENUM ('info', 'aviso', 'urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A quién se le muestra
DO $$ BEGIN
  CREATE TYPE aviso_audiencia AS ENUM (
    'todos',          -- registrados y anónimos
    'autenticados',   -- solo con sesión
    'anonimos',       -- solo sin sesión (p. ej. invitación a registrarse)
    'admins'          -- solo equipo
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────
-- 1. Tabla: avisos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo aviso_tipo NOT NULL DEFAULT 'general',
  severidad aviso_severidad NOT NULL DEFAULT 'info',
  audiencia aviso_audiencia NOT NULL DEFAULT 'todos',
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
  cuerpo text CHECK (cuerpo IS NULL OR length(cuerpo) <= 400),
  enlace text,                 -- CTA opcional
  enlace_texto text,           -- etiqueta del CTA (p. ej. "Ver el acto")
  descartable boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,    -- interruptor maestro del admin
  prioridad integer NOT NULL DEFAULT 0,    -- mayor = se muestra antes
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente_hasta timestamptz,               -- null = sin caducidad
  creado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);

CREATE TRIGGER avisos_updated_at
  BEFORE UPDATE ON avisos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Barrido rápido de los vigentes y activos
CREATE INDEX IF NOT EXISTS idx_avisos_vigentes
  ON avisos(prioridad DESC, vigente_desde DESC)
  WHERE activo = true;


-- ────────────────────────────────────────────────────────────
-- 2. Tabla: aviso_descartes
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aviso_descartes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid REFERENCES avisos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  descartado_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aviso_descartes_user
  ON aviso_descartes(user_id);


-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────

ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aviso_descartes ENABLE ROW LEVEL SECURITY;

-- SELECT de avisos: admins ven todo; el resto solo los activos, dentro
-- de vigencia y que correspondan a su estado de sesión.
CREATE POLICY "avisos_select_visibles"
  ON avisos FOR SELECT
  USING (
    is_admin()
    OR (
      activo = true
      AND now() >= vigente_desde
      AND (vigente_hasta IS NULL OR now() < vigente_hasta)
      AND (
        audiencia = 'todos'
        OR (audiencia = 'autenticados' AND auth.uid() IS NOT NULL)
        OR (audiencia = 'anonimos' AND auth.uid() IS NULL)
      )
    )
  );

-- Crear / editar / borrar avisos: solo admins
CREATE POLICY "avisos_admin_insert"
  ON avisos FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "avisos_admin_update"
  ON avisos FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "avisos_admin_delete"
  ON avisos FOR DELETE
  USING (is_admin());

-- Descartes: cada usuario gestiona los suyos
CREATE POLICY "descartes_select_own"
  ON aviso_descartes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "descartes_insert_own"
  ON aviso_descartes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "descartes_delete_own"
  ON aviso_descartes FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 3. Vista: avisos_visibles
-- Lo que el front debe pintar para el usuario actual: aplica la RLS de
-- `avisos` (vigencia + audiencia) y excluye los que ya ha descartado.
-- security_invoker → respeta la RLS del que consulta (Postgres 15+).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW avisos_visibles
WITH (security_invoker = true) AS
  SELECT a.*
    FROM avisos a
   WHERE NOT EXISTS (
     SELECT 1 FROM aviso_descartes d
      WHERE d.aviso_id = a.id
        AND d.user_id = auth.uid()
   )
   ORDER BY a.prioridad DESC, a.vigente_desde DESC;
