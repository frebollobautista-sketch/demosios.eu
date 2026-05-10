import { NextRequest, NextResponse } from "next/server";
import { resend, FROM_DEFAULT } from "@/lib/email/resend";
import { plantillaNewsletter } from "@/lib/email/plantilla-newsletter";

/**
 * POST /api/email/newsletter
 *
 * Envía una edición de la newsletter a una lista de destinatarios.
 * Body: {
 *   destinatarios: string[];        — array de emails
 *   numero: string;                 — ej. "01"
 *   fecha: string;                  — ej. "Mayo 2026"
 *   asunto: string;                 — titular
 *   reflexion: string;              — HTML de la reflexión personal
 *   novedades: { titulo, texto }[]; — bloques de novedades
 *   cierre?: string;                — frase final opcional
 * }
 *
 * Uso: solo admin (proteger con middleware o check is_admin).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { destinatarios, numero, fecha, asunto, reflexion, novedades, cierre } = body;

    if (!destinatarios?.length || !asunto || !reflexion || !novedades?.length) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (destinatarios, asunto, reflexion, novedades)" },
        { status: 400 }
      );
    }

    const html = plantillaNewsletter({ numero, fecha, asunto, reflexion, novedades, cierre });

    // Resend batch: hasta 100 emails por llamada
    const resultados = [];
    for (const email of destinatarios) {
      const { data, error } = await resend.emails.send({
        from: FROM_DEFAULT,
        to: email,
        subject: `Carta de OCRE #${numero} — ${asunto}`,
        html,
      });

      resultados.push({
        email,
        ok: !error,
        id: data?.id,
        error: error?.message,
      });
    }

    const enviados = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.filter((r) => !r.ok).length;

    return NextResponse.json({ enviados, fallidos, detalle: resultados });
  } catch (err) {
    console.error("[email/newsletter] Error inesperado:", err);
    return NextResponse.json(
      { error: "Error interno al enviar newsletter" },
      { status: 500 }
    );
  }
}
