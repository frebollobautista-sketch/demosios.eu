-- ============================================================
-- OCRE: Ajustes de perfil + Sistema de mensajería
-- Migración: 20260509000000_settings_messaging.sql
-- Descripción:
--   1. Columnas de ajustes en profiles (notificaciones, boletines,
--      privacidad, apariencia)
--   2. Tablas de mensajería: conversaciones, participantes,
--      mensajes, lecturas
--   3. RLS para mensajería (solo participantes)
--   4. Rate limiting (60 mensajes/hora)
-- Aplicada por Cowork: 2026-05-09
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Columnas de ajustes en profiles
-- ────────────────────────────────────────────────────────────

-- Notificaciones
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_respuestas_agora boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_pec boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_mensajes boolean NOT NULL DEFAULT true;

-- Boletines
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS boletin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS barrio_quincenal boolean NOT NULL DEFAULT false;

-- Privacidad
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mostrar_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_mensajes boolean NOT NULL DEFAULT true;

-- Apariencia
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tema text NOT NULL DEFAULT 'system'
    CHECK (tema IN ('light', 'dark', 'system')),
  ADD COLUMN IF NOT EXISTS tipografia text NOT NULL DEFAULT 'georgia'
    CHECK (tipografia IN ('georgia', 'inter', 'mono'));


-- ────────────────────────────────────────────────────────────
-- 2. Tabla: conversaciones
-- Una conversación es un hilo entre 2+ participantes.
-- Por ahora solo 1-a-1 (tipo = 'directa'), extensible a grupos.
-- ────────────────────────────────────────────────────────────

CREATE TYPE conversacion_tipo AS ENUM ('directa', 'grupo');

CREATE TABLE conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo conversacion_tipo NOT NULL DEFAULT 'directa',
  nombre text,  -- solo para grupos
  creado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ultimo_mensaje_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- 3. Tabla: conversacion_participantes
-- ────────────────────────────────────────────────────────────

CREATE TABLE conversacion_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid REFERENCES conversaciones(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  unido_at timestamptz NOT NULL DEFAULT now(),
  silenciada boolean NOT NULL DEFAULT false,
  UNIQUE (conversacion_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- 4. Tabla: mensajes
-- ────────────────────────────────────────────────────────────

CREATE TABLE mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid REFERENCES conversaciones(id) ON DELETE CASCADE NOT NULL,
  autor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  cuerpo text NOT NULL CHECK (length(cuerpo) BETWEEN 1 AND 2000),
  editado boolean NOT NULL DEFAULT false,
  creado timestamptz NOT NULL DEFAULT now(),
  actualizado timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER mensajes_actualizado
  BEFORE UPDATE ON mensajes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bumpa ultimo_mensaje_at en la conversación
CREATE OR REPLACE FUNCTION bump_conversacion_ultimo_mensaje()
RETURNS trigger AS $$
BEGIN
  UPDATE conversaciones SET ultimo_mensaje_at = now() WHERE id = new.conversacion_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mensajes_bump_conversacion
  AFTER INSERT ON mensajes
  FOR EACH ROW EXECUTE FUNCTION bump_conversacion_ultimo_mensaje();


-- ────────────────────────────────────────────────────────────
-- 5. Tabla: mensaje_lecturas
-- Marca de agua: último mensaje leído por usuario en conversación.
-- ────────────────────────────────────────────────────────────

CREATE TABLE mensaje_lecturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid REFERENCES conversaciones(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ultimo_leido_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversacion_id, user_id)
);


-- ────────────────────────────────────────────────────────────
-- Índices
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_conv_participantes_user ON conversacion_participantes(user_id);
CREATE INDEX idx_conv_participantes_conv ON conversacion_participantes(conversacion_id);
CREATE INDEX idx_conversaciones_ultimo ON conversaciones(ultimo_mensaje_at DESC);
CREATE INDEX idx_mensajes_conv_creado ON mensajes(conversacion_id, creado DESC);
CREATE INDEX idx_mensajes_autor ON mensajes(autor_id);
CREATE INDEX idx_lecturas_user ON mensaje_lecturas(user_id);


-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────

ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversacion_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensaje_lecturas ENABLE ROW LEVEL SECURITY;

-- Conversaciones: solo participantes
CREATE POLICY "conv_select_participant"
  ON conversaciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversacion_participantes cp
      WHERE cp.conversacion_id = conversaciones.id
        AND cp.user_id = auth.uid()
    )
    OR is_admin()
  );

CREATE POLICY "conv_insert_auth"
  ON conversaciones FOR INSERT
  WITH CHECK (creado_por = auth.uid());

-- Participantes
CREATE POLICY "conv_part_select_own"
  ON conversacion_participantes FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "conv_part_insert_member"
  ON conversacion_participantes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversacion_participantes cp
      WHERE cp.conversacion_id = conversacion_participantes.conversacion_id
        AND cp.user_id = auth.uid()
    )
    OR conversacion_participantes.user_id = auth.uid()
  );

CREATE POLICY "conv_part_delete_own"
  ON conversacion_participantes FOR DELETE
  USING (user_id = auth.uid());

-- Mensajes: solo participantes
CREATE POLICY "mensajes_select_participant"
  ON mensajes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversacion_participantes cp
      WHERE cp.conversacion_id = mensajes.conversacion_id
        AND cp.user_id = auth.uid()
    )
    OR is_admin()
  );

CREATE POLICY "mensajes_insert_participant"
  ON mensajes FOR INSERT
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversacion_participantes cp
      WHERE cp.conversacion_id = mensajes.conversacion_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "mensajes_update_own"
  ON mensajes FOR UPDATE
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "mensajes_delete_own"
  ON mensajes FOR DELETE
  USING (autor_id = auth.uid() OR is_admin());

-- Lecturas: solo el propio usuario
CREATE POLICY "lecturas_select_own"
  ON mensaje_lecturas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "lecturas_upsert_own"
  ON mensaje_lecturas FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lecturas_update_own"
  ON mensaje_lecturas FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- Anti-spam: rate limit mensajes (60/hora)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_rate_limit_mensaje()
RETURNS trigger AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt
    FROM mensajes
   WHERE autor_id = new.autor_id
     AND creado > now() - interval '1 hour';
  IF cnt >= 60 THEN
    RAISE EXCEPTION 'limite_mensajes_horario'
      USING errcode = 'P0001',
            hint = 'Has enviado 60 mensajes en la última hora. Respira.';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mensajes_rate_limit
  BEFORE INSERT ON mensajes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit_mensaje();
