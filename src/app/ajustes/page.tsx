import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TogglePrivacidad } from "./TogglePrivacidad";
import { ToggleDemo, RadioDemo } from "./PreferenciasPlaceholder";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata = {
  title: "Ajustes",
  description: "Configura tu cuenta, notificaciones, privacidad y apariencia.",
};

/**
 * /ajustes — pantalla completa con 5 secciones:
 *  · Notificaciones — qué quieres recibir
 *  · Privacidad — quién puede ver qué
 *  · Cuenta — credenciales y datos
 *  · Apariencia — tema y tipografía
 *  · Datos (RGPD) — descarga y eliminación
 *
 * Estado actual: las funcionalidades realmente persistidas en Supabase
 * son `Privacidad: perfil público`. El resto se almacena en localStorage
 * como demo de UX hasta que migremos a Supabase (columnas de profiles
 * o tabla preferencias).
 *
 * Decisión 2026-05-09 con Panch: aunque algunas funciones todavía no
 * persistan en BD, mostrar TODAS las opciones para que el usuario pueda
 * "ver lo que tiene disponible" y validar el alcance del producto.
 */
export default async function AjustesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/ajustes");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_public, handle, display_name")
    .eq("id", user.id)
    .single();

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
        Configuración de tu cuenta y preferencias. Los toggles marcados como{" "}
        <span
          className="text-[0.7rem] tracking-wider px-1.5 py-0.5 rounded"
          style={{
            background: "var(--color-papiro-soft)",
            color: "var(--color-piedra)",
            textTransform: "uppercase",
          }}
        >
          Próx.
        </span>{" "}
        muestran funcionalidades que llegarán pronto pero aún no están activas.
      </p>

      <div className="divisor my-8" />

      {/* ─── Notificaciones ─── */}
      <Seccion
        titulo="Notificaciones"
        descripcion="Lo que recibes por correo. Sin notificaciones push: nunca te interrumpiremos en el móvil."
      >
        <ToggleDemo
          storageKey="ocre.notif.respuestas-agora"
          label="Cuando alguien responde en mis hilos de Ágora"
          descripcion="Te avisamos por email para que puedas seguir la conversación."
          defecto={true}
          soon
        />
        <ToggleDemo
          storageKey="ocre.notif.pec-recibido"
          label="Cuando recibo PEC en hilos o comentarios"
          descripcion="Resumen diario, no aviso por cada uno."
          defecto={false}
          soon
        />
        <ToggleDemo
          storageKey="ocre.notif.mensaje-privado"
          label="Cuando recibo un mensaje privado"
          defecto={true}
          soon
        />
        <ToggleDemo
          storageKey="ocre.notif.boletin-semanal"
          label="Boletín semanal de OCRE"
          descripcion="Resumen de Canarias en Datos, hilos destacados y novedades de Bibliotheka."
          defecto={false}
          soon
        />
        <ToggleDemo
          storageKey="ocre.notif.barrio-quincenal"
          label="Resumen quincenal de actividad de mi barrio"
          descripcion="Lo que ha pasado cerca: hilos abiertos, nuevos recursos, cambios en POLIS."
          defecto={false}
          soon
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
            inicial={perfil?.is_public ?? true}
          />
        </div>
        <div className="mt-2">
          <ToggleDemo
            storageKey="ocre.priv.mostrar-email"
            label="Mostrar mi email en mi perfil público"
            descripcion="Solo otros usuarios registrados verán el email."
            defecto={false}
            soon
          />
          <ToggleDemo
            storageKey="ocre.priv.permitir-mensajes"
            label="Permitir que cualquier usuario me escriba"
            descripcion="Si lo desactivas, solo te escribirán quienes tú sigas."
            defecto={true}
            soon
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
            accionLabel="Cambiar"
            accionHref="/ajustes/cambiar-email"
            soon
          />
          <CampoCuenta
            label="Handle"
            valor={`@${perfil?.handle ?? "—"}`}
            accionLabel="Cambiar"
            accionHref="/ajustes/cambiar-handle"
            soon
          />
          <CampoCuenta
            label="Contraseña"
            valor="••••••••"
            accionLabel="Cambiar"
            accionHref="/ajustes/cambiar-password"
            soon
          />
          <CampoCuenta
            label="Sesiones activas"
            valor="1 dispositivo"
            accionLabel="Cerrar las demás"
            accionHref="/ajustes/sesiones"
            soon
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <LogoutButton variant="button" />
          <span
            className="text-[0.8rem]"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Eliminar cuenta · <em className="italic">próximamente</em>
          </span>
        </div>
      </Seccion>

      {/* ─── Apariencia ─── */}
      <Seccion
        titulo="Apariencia"
        descripcion="Cómo se ve OCRE en tu navegador. Se guarda solo en este dispositivo."
      >
        <RadioDemo
          storageKey="ocre.tema"
          label="Tema"
          opciones={[
            { value: "auto", label: "Auto (sistema)" },
            { value: "claro", label: "Claro" },
            { value: "oscuro", label: "Oscuro" },
          ]}
          defecto="auto"
          soon
        />
        <RadioDemo
          storageKey="ocre.tipografia"
          label="Tamaño de tipografía"
          opciones={[
            { value: "s", label: "Pequeña" },
            { value: "m", label: "Media" },
            { value: "l", label: "Grande" },
          ]}
          defecto="m"
          soon
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
            label="Solicitar descarga"
            href="/ajustes/descargar-datos"
            soon
          />
          <Accion
            titulo="Eliminar mi historial de actividad"
            descripcion="Borra hilos, comentarios y reacciones que hayas hecho. Conserva tu cuenta."
            label="Eliminar historial"
            href="/ajustes/borrar-historial"
            soon
            destructiva
          />
          <Accion
            titulo="Eliminar mi cuenta entera"
            descripcion="Acción irreversible. Todo lo tuyo se borra y no se puede recuperar."
            label="Eliminar cuenta"
            href="/ajustes/eliminar-cuenta"
            soon
            destructiva
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

/* ─────────── Helpers de presentación ─────────── */

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
  accionLabel,
  soon,
}: {
  label: string;
  valor: string;
  accionLabel: string;
  accionHref: string;
  soon?: boolean;
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
      {soon ? (
        <span
          className="text-[0.78rem] shrink-0"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {accionLabel} <em className="italic">(próx.)</em>
        </span>
      ) : null}
    </div>
  );
}

function Accion({
  titulo,
  descripcion,
  soon,
  destructiva,
}: {
  titulo: string;
  descripcion: string;
  label: string;
  href: string;
  soon?: boolean;
  destructiva?: boolean;
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
      {soon ? (
        <span
          className="text-[0.78rem] shrink-0"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          <em className="italic">próximamente</em>
        </span>
      ) : null}
    </div>
  );
}
