-- ============================================================
-- OCRE: Modelo de notificaciones + preferencias (extensión)
-- Migración: 20260603000000_notificaciones.sql
-- Descripción:
--   1. Amplía las preferencias de profiles (menciones, frecuencia,
--      token de baja en un clic)
--   2. Tabla `notificaciones`: feed in-app + fuente de los resúmenes
--      (digests) que envía la edge function con Resend
--   3. RLS (cada usuario solo ve las suyas; la edge function escribe
--      con service_role, que salta RLS)
--   4. RPC `darse_de_baja_email(token, categoria)` para el enlace de
--      baja del boletín SIN login (List-Unsubscribe en un clic)
--
--   NOTA: idempotente y no destructiva. No toca las columnas de
--   preferencias que ya existían en 20260509000000_settings_messaging.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Preferencias nuevas en profiles
-- ────────────────────────────────────────────────────────────

-- Falta el toggle de menciones (@usuario)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_menciones boolean NOT NULL DEFAULT true;

-- Frecuencia de los avisos de interacción (mensajes, respuestas,
-- menciones, pec). NO afecta a seguridad ni a transaccionales.
--   inmediato → un correo por evento
--   diario    → un resumen al día
--   semanal   → un resumen a la semana
DO $$ BEGIN
  CREATE TYPE notif_frecuencia AS ENUM ('inmediato', 'diario', 'semanal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_frecuencia notif_frecuencia NOT NULL DEFAULT 'inmediato';

-- Token estable para la baja en un clic (List-Unsubscribe sin login).
-- Es secreto-suave: solo permite APAGAR avisos, nunca leer datos.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unsubscribe_token
  ON profiles(unsubscribe_token);


-- ────────────────────────────────────────────────────────────
-- 2. Tabla: notificaciones
-- Una fila por aviso. Sirve a la vez como:
--   · feed de notificaciones dentro de la web (leida_at)
--   · cola de envío de correo (email_estado)
--   · fuente de los resúmenes diario/semanal
-- La crea la edge function (service_role). El cuerpo_preview ya
-- viene recortado y escapado desde la function.
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notificacion_tipo AS ENUM (
    'mensaje_privado',      -- plantilla 4
    'respuesta_agora',      -- plantilla 5
    'mencion',              -- @usuario
    'pec',                  -- decisiones / PEC en Ágora
    'acto_inscrito',        -- confirmación de inscripción a un acto
    'acto_recordatorio',    -- 24h antes
    'acto_cambio',          -- cambio o cancelación
    'novedad_tema',         -- Canarias en Datos / Bibliotheka
    'moderacion',           -- contenido retirado / reporte resuelto
    'seguridad'             -- login nuevo, contraseña cambiada (forzado)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notif_email_estado AS ENUM (
    'pendiente',  -- recién creada, aún sin decidir
    'enviado',    -- correo enviado (inmediato)
    'encolado',   -- esperando al resumen diario/semanal
    'omitido'     -- el usuario tiene el aviso desactivado
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tipo notificacion_tipo NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- quién lo provoca (puede ser null: sistema)
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 200),
  cuerpo_preview text CHECK (cuerpo_preview IS NULL OR length(cuerpo_preview) <= 240),
  enlace text,                       -- a dónde lleva el botón
  datos jsonb NOT NULL DEFAULT '{}', -- extras por tipo (id de hilo, etc.)
  leida_at timestamptz,              -- null = no leída (feed in-app)
  email_estado notif_email_estado NOT NULL DEFAULT 'pendiente',
  email_enviado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- Índices
-- ────────────────────────────────────────────────────────────

-- Feed in-app: las del usuario, más recientes primero
CREATE INDEX IF NOT EXISTS idx_notif_user_creada
  ON notificaciones(user_id, created_at DESC);

-- Contador de no leídas
CREATE INDEX IF NOT EXISTS idx_notif_no_leidas
  ON notificaciones(user_id) WHERE leida_at IS NULL;

-- Barrido del cron de resúmenes: solo las encoladas
CREATE INDEX IF NOT EXISTS idx_notif_encoladas
  ON notificaciones(user_id, created_at) WHERE email_estado = 'encolado';


-- ────────────────────────────────────────────────────────────
-- Row Level Security
-- Cada usuario solo ve sus notificaciones. La inserción la hace la
-- edge function con service_role (salta RLS), así que NO hay política
-- de INSERT para usuarios: nadie puede fabricarle avisos a otro.
-- ────────────────────────────────────────────────────────────

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own"
  ON notificaciones FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- El usuario solo puede marcar como leída (UPDATE de leida_at) las suyas
CREATE POLICY "notif_update_own"
  ON notificaciones FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_delete_own"
  ON notificaciones FOR DELETE
  USING (user_id = auth.uid() OR is_admin());


-- ────────────────────────────────────────────────────────────
-- 3. RPC: baja en un clic (sin login)
-- La llama la página /baja?token=... que abre el enlace del correo,
-- y también el endpoint del header List-Unsubscribe-Post.
-- SECURITY DEFINER para poder escribir sin sesión, pero SOLO apaga
-- preferencias: no devuelve ni expone ningún dato del perfil.
--   categoria: 'boletin' | 'barrio' | 'novedades' | 'todo'
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION darse_de_baja_email(
  p_token uuid,
  p_categoria text DEFAULT 'boletin'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM profiles WHERE unsubscribe_token = p_token;
  IF v_id IS NULL THEN
    RETURN false;  -- token inválido: no revelamos nada
  END IF;

  IF p_categoria = 'boletin' THEN
    UPDATE profiles SET boletin = false WHERE id = v_id;
  ELSIF p_categoria = 'barrio' THEN
    UPDATE profiles SET barrio_quincenal = false WHERE id = v_id;
  ELSIF p_categoria = 'todo' THEN
    -- "Baja de todo el correo no esencial" (no toca seguridad)
    UPDATE profiles
       SET boletin = false,
           barrio_quincenal = false,
           notif_respuestas_agora = false,
           notif_menciones = false,
           notif_pec = false,
           notif_mensajes = false
     WHERE id = v_id;
  ELSE
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Cualquiera con el token puede ejecutarla (es el caso del enlace del correo)
GRANT EXECUTE ON FUNCTION darse_de_baja_email(uuid, text) TO anon, authenticated;
