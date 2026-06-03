/**
 * Traducción de errores de Supabase Auth a mensajes claros en español.
 *
 * Supabase devuelve mensajes en inglés y, a veces, con un `code` estable.
 * Preferimos mapear por `code` cuando existe; si no, por substring del
 * mensaje. Devolvemos siempre una frase humana y accionable.
 */

import type { AuthError } from "@supabase/supabase-js";

type ErrorLike =
  | AuthError
  | { message?: string; code?: string; status?: number }
  | null
  | undefined;

const POR_CODIGO: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed:
    "Tu correo aún no está confirmado. Revisa tu bandeja (y el spam) y pulsa el enlace de confirmación.",
  user_already_exists: "Ya existe una cuenta con este correo. Prueba a iniciar sesión.",
  email_exists: "Ya existe una cuenta con este correo. Prueba a iniciar sesión.",
  weak_password:
    "La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.",
  over_email_send_rate_limit:
    "Has pedido demasiados correos seguidos. Espera unos minutos antes de volver a intentarlo.",
  over_request_rate_limit:
    "Demasiados intentos. Espera un momento y vuelve a probar.",
  otp_expired:
    "El enlace ha caducado. Pide uno nuevo e inténtalo de nuevo.",
  same_password:
    "La nueva contraseña no puede ser igual a la anterior.",
  signup_disabled: "El registro está temporalmente desactivado.",
  unexpected_failure:
    "Ese código de invitación no es válido o ya se ha usado. Pide uno nuevo.",
  provider_disabled:
    "Este método de acceso no está activado todavía. Prueba con correo o contraseña.",
  validation_failed: "Revisa los datos introducidos.",
  user_not_found: "No encontramos ninguna cuenta con esos datos.",
};

const POR_TEXTO: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i,
    "Tu correo aún no está confirmado. Revisa tu bandeja (y el spam) y pulsa el enlace de confirmación."],
  [/user already registered|already registered/i,
    "Ya existe una cuenta con este correo. Prueba a iniciar sesión."],
  [/password should be at least/i,
    "La contraseña debe tener al menos 8 caracteres."],
  [/weak password/i,
    "La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números."],
  [/rate limit|too many requests/i,
    "Demasiados intentos. Espera un momento y vuelve a probar."],
  [/provider is not enabled|provider .* disabled/i,
    "Este método de acceso no está activado todavía. Prueba con correo o contraseña."],
  [/expired|invalid.*token|otp/i,
    "El enlace ha caducado o no es válido. Pide uno nuevo."],
  [/network|fetch|failed to fetch/i,
    "No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo."],
  [/for security purposes/i,
    "Por seguridad, espera unos segundos antes de volver a intentarlo."],
  // Errores levantados por el trigger handle_new_user (modo cerrado). Supabase
  // los envuelve como "Database error saving new user".
  [/invitacion_requerida|invitacion_invalida|database error saving new user/i,
    "Ese código de invitación no es válido o ya se ha usado. Pide uno nuevo."],
];

/** Convierte un error de Supabase Auth en un mensaje en español. */
export function mensajeAuth(error: ErrorLike): string {
  if (!error) return "Ha ocurrido un error. Inténtalo de nuevo.";

  const code = (error as { code?: string }).code;
  if (code && POR_CODIGO[code]) return POR_CODIGO[code];

  const msg = error.message ?? "";
  for (const [re, texto] of POR_TEXTO) {
    if (re.test(msg)) return texto;
  }

  // Último recurso: mensaje genérico (no exponemos el inglés crudo).
  return "No hemos podido completar la acción. Inténtalo de nuevo en un momento.";
}
