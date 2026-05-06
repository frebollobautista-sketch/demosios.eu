"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Formulario público de solicitud de consultoría a OCRE.
 *
 * Persiste a Supabase (tabla `consultoria_solicitudes`) y opcionalmente
 * sube hasta 5 adjuntos (PDF/JPG/PNG/WebP, max 10 MB cada uno) al bucket
 * `consultoria-uploads`. Si la migración Supabase aún no se ha aplicado,
 * detectamos el error de tabla inexistente y degradamos a `mailto:` con
 * el cuerpo prerellenado.
 *
 * Validación cliente:
 *  - Introducción: 30..1000 palabras (≈ 7.500 chars máx)
 *  - Outcome: 30..500 palabras (≈ 3.750 chars máx)
 *  - Archivos: máx 5, máx 10 MB cada uno, mime PDF/JPG/PNG/WebP
 *
 * No requiere autenticación. Política RLS permite INSERT a `anon`.
 */

const MAX_PALABRAS_INTRO = 1000;
const MAX_PALABRAS_OUTCOME = 500;
const MIN_PALABRAS = 30;
const MAX_ARCHIVOS = 5;
const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024; // 10 MB
const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const HOLA_EMAIL = "hola@demosios.eu";

function contarPalabras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

type Estado = "idle" | "enviando" | "enviado" | "error";

export function ConsultoriaForm() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [asunto, setAsunto] = useState("");
  const [introduccion, setIntroduccion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [suscribirBoletin, setSuscribirBoletin] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);

  const [estado, setEstado] = useState<Estado>("idle");
  const [mensaje, setMensaje] = useState("");
  const archivosInputRef = useRef<HTMLInputElement>(null);

  const palabrasIntro = contarPalabras(introduccion);
  const palabrasOutcome = contarPalabras(outcome);

  const introOk =
    palabrasIntro >= MIN_PALABRAS && palabrasIntro <= MAX_PALABRAS_INTRO;
  const outcomeOk =
    palabrasOutcome >= MIN_PALABRAS && palabrasOutcome <= MAX_PALABRAS_OUTCOME;

  const onArchivosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files || []);
    const validos: File[] = [];
    const errores: string[] = [];

    for (const f of lista) {
      if (!TIPOS_PERMITIDOS.includes(f.type)) {
        errores.push(`${f.name}: tipo no permitido (solo PDF, JPG, PNG, WebP).`);
        continue;
      }
      if (f.size > MAX_TAMANO_ARCHIVO) {
        errores.push(`${f.name}: supera 10 MB.`);
        continue;
      }
      validos.push(f);
    }

    const total = [...archivos, ...validos].slice(0, MAX_ARCHIVOS);
    setArchivos(total);

    if (errores.length) {
      setMensaje(errores.join(" "));
      setEstado("error");
    } else {
      setEstado("idle");
      setMensaje("");
    }

    // Permite re-seleccionar el mismo archivo si el usuario lo quita y vuelve a añadirlo.
    if (archivosInputRef.current) archivosInputRef.current.value = "";
  };

  const quitarArchivo = (idx: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== idx));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim() || !email.trim() || !asunto.trim()) {
      setEstado("error");
      setMensaje("Faltan campos obligatorios.");
      return;
    }
    if (!introOk) {
      setEstado("error");
      setMensaje(
        `La introducción debe tener entre ${MIN_PALABRAS} y ${MAX_PALABRAS_INTRO} palabras (ahora: ${palabrasIntro}).`,
      );
      return;
    }
    if (!outcomeOk) {
      setEstado("error");
      setMensaje(
        `El outcome debe tener entre ${MIN_PALABRAS} y ${MAX_PALABRAS_OUTCOME} palabras (ahora: ${palabrasOutcome}).`,
      );
      return;
    }

    setEstado("enviando");
    setMensaje("");

    try {
      const supabase = createClient();

      // 1) Insertar la fila para obtener el id
      const { data: filaCreada, error: errInsert } = await supabase
        .from("consultoria_solicitudes")
        .insert({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          asunto: asunto.trim(),
          introduccion: introduccion.trim(),
          outcome: outcome.trim(),
          suscribir_boletin: suscribirBoletin,
          archivos_paths: [],
        })
        .select("id")
        .single();

      if (errInsert || !filaCreada) {
        // Si la tabla aún no existe (migración no aplicada), degradar a mailto:
        if (
          errInsert?.message?.includes("does not exist") ||
          errInsert?.code === "42P01" ||
          errInsert?.code === "PGRST116"
        ) {
          fallbackMailto();
          return;
        }
        throw errInsert || new Error("No se pudo crear la solicitud");
      }

      const solicitudId = filaCreada.id as string;

      // 2) Subir archivos al bucket consultoria-uploads
      const pathsSubidos: string[] = [];
      for (const file of archivos) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
        const path = `${solicitudId}/${Date.now()}_${safeName}`;
        const { error: errUpload } = await supabase.storage
          .from("consultoria-uploads")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
        if (errUpload) {
          // No hacemos rollback de la fila — registramos el problema y seguimos.
          console.warn(`Upload falló para ${file.name}:`, errUpload);
          continue;
        }
        pathsSubidos.push(path);
      }

      // 3) Actualizar la fila con los paths reales
      if (pathsSubidos.length) {
        await supabase
          .from("consultoria_solicitudes")
          .update({ archivos_paths: pathsSubidos })
          .eq("id", solicitudId);
      }

      setEstado("enviado");
      setMensaje(
        "Recibido. Hemos registrado tu solicitud y te responderemos al correo indicado en un máximo de 5 días laborables.",
      );
    } catch (err) {
      console.error("Error enviando consultoría:", err);
      setEstado("error");
      setMensaje(
        "No hemos podido enviar la solicitud. Inténtalo de nuevo o escríbenos a " +
          HOLA_EMAIL +
          ".",
      );
    }
  };

  const fallbackMailto = () => {
    // Fallback: abrir cliente de correo con un cuerpo prearmado.
    // Útil mientras la migración Supabase no esté aplicada.
    const body = [
      `Nombre / Razón social: ${nombre}`,
      `Email: ${email}`,
      `Asunto: ${asunto}`,
      `Suscribir al boletín: ${suscribirBoletin ? "Sí" : "No"}`,
      "",
      "--- Introducción ---",
      introduccion,
      "",
      "--- Outcome (perspectivas de resultado) ---",
      outcome,
    ].join("\n");
    const url = `mailto:${HOLA_EMAIL}?subject=${encodeURIComponent(
      "Consulta OCRE — " + asunto,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setEstado("enviado");
    setMensaje(
      "Te hemos abierto el correo con la solicitud preparada. Pulsa enviar en tu cliente para hacérnosla llegar.",
    );
  };

  if (estado === "enviado") {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <div className="eyebrow mb-2" style={{ color: "var(--color-ocre-deep)" }}>
          ✓ Solicitud registrada
        </div>
        <p
          className="text-[1rem] max-w-xl mx-auto"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          {mensaje}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate>
      <Campo label="Nombre / Razón social" obligatorio>
        <input
          type="text"
          required
          maxLength={200}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="organization"
          className="w-full rounded-md px-3 py-2 text-[0.95rem]"
          style={inputStyle}
        />
      </Campo>

      <Campo label="Correo electrónico" obligatorio>
        <input
          type="email"
          required
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full rounded-md px-3 py-2 text-[0.95rem]"
          style={inputStyle}
        />
      </Campo>

      <Campo label="Asunto de la consultoría" obligatorio>
        <input
          type="text"
          required
          maxLength={200}
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          placeholder="Ej. Diagnóstico de transparencia activa para ayuntamiento de 25 mil hab."
          className="w-full rounded-md px-3 py-2 text-[0.95rem]"
          style={inputStyle}
        />
      </Campo>

      <Campo
        label="Breve introducción"
        obligatorio
        ayuda={`${palabrasIntro} / ${MAX_PALABRAS_INTRO} palabras (mínimo ${MIN_PALABRAS})`}
        ayudaError={
          introduccion.length > 0 && !introOk
            ? palabrasIntro < MIN_PALABRAS
              ? "Demasiado breve."
              : "Has superado el límite."
            : null
        }
      >
        <textarea
          required
          rows={8}
          value={introduccion}
          onChange={(e) => setIntroduccion(e.target.value)}
          placeholder="Cuéntanos quién eres, en qué contexto operas, y qué necesitas. Cuantos más datos concretos (territorio, escala, plazos, encaje legal), mejor podremos orientar la respuesta."
          className="w-full rounded-md px-3 py-2 text-[0.95rem] leading-relaxed"
          style={inputStyle}
        />
      </Campo>

      <Campo label="Adjuntos" ayuda={`Hasta ${MAX_ARCHIVOS} archivos. PDF, JPG, PNG o WebP. Máx 10 MB cada uno.`}>
        <input
          ref={archivosInputRef}
          type="file"
          multiple
          accept={TIPOS_PERMITIDOS.join(",")}
          onChange={onArchivosChange}
          className="text-[0.85rem] w-full"
          style={{ color: "var(--color-piedra)" }}
        />
        {archivos.length > 0 && (
          <ul className="mt-2 space-y-1 text-[0.85rem]">
            {archivos.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md px-2 py-1"
                style={{
                  background: "var(--color-papiro-soft)",
                  color: "var(--color-piedra)",
                }}
              >
                <span className="truncate pr-2">
                  {f.name}{" "}
                  <span style={{ color: "var(--color-piedra-clara)" }}>
                    · {(f.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => quitarArchivo(i)}
                  className="text-[0.8rem] underline shrink-0"
                  style={{ color: "var(--color-ocre-deep)" }}
                >
                  quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Campo>

      <Campo
        label="Outcome — perspectivas de resultado"
        obligatorio
        ayuda={`${palabrasOutcome} / ${MAX_PALABRAS_OUTCOME} palabras (mínimo ${MIN_PALABRAS})`}
        ayudaError={
          outcome.length > 0 && !outcomeOk
            ? palabrasOutcome < MIN_PALABRAS
              ? "Demasiado breve."
              : "Has superado el límite."
            : null
        }
      >
        <textarea
          required
          rows={5}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="¿Qué esperas que pase si trabajamos juntos? ¿Qué cambia para tu organización, tus beneficiarios o el territorio si esto sale bien? Sé concreto."
          className="w-full rounded-md px-3 py-2 text-[0.95rem] leading-relaxed"
          style={inputStyle}
        />
      </Campo>

      <label className="flex items-start gap-3 cursor-pointer text-[0.92rem]">
        <input
          type="checkbox"
          checked={suscribirBoletin}
          onChange={(e) => setSuscribirBoletin(e.target.checked)}
          className="mt-1"
          style={{ accentColor: "var(--color-ocre-deep)" }}
        />
        <span style={{ color: "var(--color-piedra)" }}>
          Quiero recibir el <strong>boletín semanal de OCRE</strong> en este
          correo. Resumen breve de lo publicado en Canarias en Datos, novedades
          de consultoría y avisos de actos públicos. Bajable en un click.
        </span>
      </label>

      {estado === "error" && (
        <p
          className="text-[0.9rem] rounded-md px-3 py-2"
          style={{
            background: "rgba(196, 90, 74, 0.08)",
            border: "1px solid rgba(196, 90, 74, 0.4)",
            color: "#a04030",
          }}
          role="alert"
        >
          {mensaje}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={estado === "enviando"}
          className="px-5 py-2.5 rounded-md text-[0.95rem] font-semibold disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {estado === "enviando" ? "Enviando…" : "Enviar solicitud"}
        </button>
        <p
          className="text-[0.78rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          Tus datos los trata OCRE para responder a esta consulta. No los
          cedemos a terceros. Puedes ejercer tus derechos escribiendo a{" "}
          {HOLA_EMAIL}.
        </p>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-papiro)",
  border: "1px solid var(--color-linea)",
  color: "var(--color-papiro-ink)",
  outline: "none",
};

function Campo({
  label,
  obligatorio,
  ayuda,
  ayudaError,
  children,
}: {
  label: string;
  obligatorio?: boolean;
  ayuda?: string;
  ayudaError?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-baseline justify-between mb-1.5 gap-3">
        <span
          className="text-[0.85rem] font-semibold"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          {label}
          {obligatorio && (
            <span style={{ color: "var(--color-ocre-deep)" }}> ·</span>
          )}
        </span>
        {ayuda && (
          <span
            className="text-[0.75rem] tabular-nums"
            style={{
              color: ayudaError
                ? "#a04030"
                : "var(--color-piedra-clara)",
            }}
          >
            {ayuda}
            {ayudaError && ` · ${ayudaError}`}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
