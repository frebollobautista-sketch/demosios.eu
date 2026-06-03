import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TogglePrivacidad } from "./TogglePrivacidad";
import { ToggleReal, RadioReal } from "./PreferenciasReal";
import { LogoutButton } from "@/components/LogoutButton";
import { getPreferencias } from "@/lib/ajustes/queries";

export const metadata = {
  title: "Ajustes",
  description: "Configura tu cuenta, notificaciones, privacidad y apariencia.",
};

/**
 * /ajustes — pantalla con 5 secciones, todas conectadas a Supabase.
 *
 * Las preferencias persisten en columnas de `profiles` añadidas en la
 * migración 20260509000000_settings_messaging.sql:
 *   notif_respuestas_agora, notif_pec, notif_mensajes (notificaciones)
 *   boletin, barrio_quincenal (boletines)
 *   mostrar_email, permitir_mensajes (privacidad)
 *   tema, tipografia (apariencia)
 *   is_public (ya existía, gestionada por TogglePrivacidad)
 *
 * Pendientes (acciones, no preferencias):
 *  - Cambiar email/handle/contraseña → Supabase Auth + RLS
 *  - Cerrar sesiones de otros dispositivos → admin de sesiones
 *  - Descargar datos (RGPD) → edge function que junte tablas y firme zip
 *  - Eliminar cuenta → soft delete + cascada
 */
export default async function AjustesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/ajustes");

  const [{ data: perfilBase }, prefs] = await Promise.all([
    supabase
      .from("profiles")
      .select("handle, display_name, is_public")
      .eq("id", user.id)
      .single(),
    getPreferencias(supabase, user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Tu cuenta</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.2vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Ajustes
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Tus preferencias se guardan al instante. Cada cambio se sincroniza
        en todos tus dispositivos.
      </p>

      <div className="divisor my-8" />

      {/* ─── Notificaciones ─── */}
      <Seccion
        titulo="Notificaciones"
        descripcion="Lo que recibes por correo. Sin notificaciones push: nunca te interrumpiremos en el móvil."
      >
        <ToggleReal
          userId={user.id}
          campo="notif_respuestas_agora"
          inicial={prefs.notif_respuestas_agora}
          label="Cuando alguien responde en mis hilos de Ágora"
          descripcion="Te avisamos por email para que puedas seguir la conversación."
        />
        <ToggleReal
          userId={user.id}
          campo="notif_pec"
          inicial={prefs.notif_pec}
          label="Cuando recibo PEC en hilos o comentarios"
          descripcion="Resumen diario, no aviso por cada uno."
        />
        <ToggleReal
          userId={user.id}
          campo="notif_mensajes"
          inicial={prefs.notif_mensajes}
          label="Cuando recibo un mensaje privado"
        />
        <ToggleReal
          userId={user.id}
          campo="boletin"
          inicial={prefs.boletin}
          label="Boletín semanal de OCRE"
          descripcion="Resumen de Canarias en Datos, hilos destacados y novedades de Bibliotheka."
        />
        <ToggleReal
          userId={user.id}
          campo="barrio_quincenal"
          inicial={prefs.barrio_quincenal}
          label="Resumen quincenal de actividad de mi barrio"
          descripcion="Lo que ha pasado cerca: hilos abiertos, nuevos recursos, cambios en POLIS."
        />
      </Seccion>

      {/* ─── Privacidad ─── */}
      <Seccion
        titulo="Privacidad"
        descripcion="Quién puede ver tu perfil y tus contribuciones."
      >
        <div
          className="rounded-lg p-4"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <TogglePrivacidad
            userId={user.id}
            inicial={perfilBase?.is_public ?? true}
          />
        </div>
        <div className="mt-2">
          <ToggleReal
            userId={user.id}
            campo="mostrar_email"
            inicial={prefs.mostrar_email}
            label="Mostrar mi email en mi perfil público"
            descripcion="Solo otros usuarios registrados verán el email."
          />
          <ToggleReal
            userId={user.id}
            campo="permitir_mensajes"
            inicial={prefs.permitir_mensajes}
            label="Permitir que cualquier usuario me escriba"
            descripcion="Si lo desactivas, solo te escribirán quienes tú sigas."
          />
        </div>
      </Seccion>

      {/* ─── Cuenta ─── */}
      <Seccion
        titulo="Cuenta"
        descripcion="Credenciales y datos básicos."
      >
        <div
          className="rounded-lg p-4 space-y-2"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <CampoCuenta
            label="Email"
            valor={user.email || "—"}
            soonLabel="Cambiar"
            href="/ajustes/cambiar-email"
          />
          <CampoCuenta
            label="Handle"
            valor={`@${perfilBase?.handle ?? "—"}`}
            soonLabel="Cambiar"
          />
          <CampoCuenta
            label="Contraseña"
            valor="••••••••"
            soonLabel="Cambiar"
            href="/ajustes/cambiar-password"
          />
          <CampoCuenta
            label="Sesiones activas"
            valor="1 dispositivo"
            soonLabel="Gestionar"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <LogoutButton variant="button" />
          <Link
            href="/ajustes/eliminar-cuenta"
            className="text-[0.8rem] underline"
            style={{ color: "#a04030" }}
          >
            Eliminar cuenta
          </Link>
        </div>
      </Seccion>

      {/* ─── Apariencia ─── */}
      <Seccion
        titulo="Apariencia"
        descripcion="Cómo se ve OCRE. Se sincroniza en todos tus dispositivos."
      >
        <RadioReal
          userId={user.id}
          campo="tema"
          inicial={prefs.tema}
          label="Tema"
          opciones={[
            { value: "system", label: "Auto (sistema)" },
            { value: "light", label: "Claro" },
            { value: "dark", label: "Oscuro" },
          ]}
        />
        <RadioReal
          userId={user.id}
          campo="tipografia"
          inicial={prefs.tipografia}
          label="Tipografía"
          descripcion="Estilo de letra para textos largos."
          opciones={[
            { value: "georgia", label: "Georgia (serif)" },
            { value: "inter", label: "Inter (sans)" },
            { value: "mono", label: "Mono" },
          ]}
        />
      </Seccion>

      {/* ─── Datos (RGPD) ─── */}
      <Seccion
        titulo="Tus datos"
        descripcion="Derechos RGPD: descarga y eliminación."
      >
        <div
          className="rounded-lg p-4 space-y-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <Accion
            titulo="Descargar mis datos"
            descripcion="Recibirás un archivo JSON con todo lo que has publicado y aportado."
            soon
          />
          <Accion
            titulo="Eliminar mi historial de actividad"
            descripcion="Borra hilos, comentarios y reacciones que hayas hecho. Conserva tu cuenta."
            soon
            destructiva
          />
          <Accion
            titulo="Eliminar mi cuenta entera"
            descripcion="Acción irreversible. Todo lo tuyo se borra y no se puede recuperar."
            destructiva
            href="/ajustes/eliminar-cuenta"
          />
        </div>
      </Seccion>

      <p
        className="mt-12 text-[0.82rem] text-center"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Volver a{" "}
        <Link
          href="/"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Inicio
        </Link>
        .
      </p>
    </div>
  );
}

/* ─────────── Helpers ─────────── */

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2
        className="display text-[1.1rem] mb-1"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {titulo}
      </h2>
      {descripcion && (
        <p
          className="text-[0.88rem] mb-4 max-w-2xl"
          style={{ color: "var(--color-piedra)", lineHeight: 1.5 }}
        >
          {descripcion}
        </p>
      )}
      <div>{children}</div>
    </section>
  );
}

function CampoCuenta({
  label,
  valor,
  soonLabel,
  href,
}: {
  label: string;
  valor: string;
  soonLabel: string;
  href?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2"
      style={{ borderBottom: "1px solid var(--color-linea)" }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="eyebrow"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {label}
        </div>
        <div
          className="text-[0.92rem] truncate"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          {valor}
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="text-[0.82rem] shrink-0 underline font-medium"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          {soonLabel}
        </Link>
      ) : (
        <span
          className="text-[0.78rem] shrink-0"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {soonLabel} <em className="italic">(próx.)</em>
        </span>
      )}
    </div>
  );
}

function Accion({
  titulo,
  descripcion,
  soon,
  destructiva,
  href,
}: {
  titulo: string;
  descripcion: string;
  soon?: boolean;
  destructiva?: boolean;
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div
          className="text-[0.92rem]"
          style={{
            color: destructiva ? "#a04030" : "var(--color-papiro-ink)",
            fontWeight: 500,
          }}
        >
          {titulo}
        </div>
        <p
          className="text-[0.8rem] mt-0.5"
          style={{ color: "var(--color-piedra)", lineHeight: 1.45 }}
        >
          {descripcion}
        </p>
      </div>
      {href ? (
        <Link
          href={href}
          className="text-[0.8rem] shrink-0 underline font-medium"
          style={{ color: destructiva ? "#a04030" : "var(--color-ocre-deep)" }}
        >
          Continuar
        </Link>
      ) : (
        soon && (
          <span
            className="text-[0.78rem] shrink-0"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            <em className="italic">próximamente</em>
          </span>
        )
      )}
    </div>
  );
}
