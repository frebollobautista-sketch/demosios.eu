import { NextRequest, NextResponse } from "next/server";
import { resend, FROM_DEFAULT } from "@/lib/email/resend";
import { plantillaBienvenida } from "@/lib/email/plantilla-bienvenida";

/**
 * POST /api/email/bienvenida
 *
 * Envía el email de bienvenida a un usuario recién registrado.
 * Body: { email: string; nombre?: string }
 *
 * Uso previsto:
 *  - Llamado desde un webhook de Supabase Auth (on user.created)
 *  - O manualmente desde el panel de admin
 */
export async function POST(req: NextRequest) {
  try {
    const { email, nombre } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Falta el campo 'email'" },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: FROM_DEFAULT,
      to: email,
      subject: "Bienvenido/a a OCRE — tu espacio cívico",
      html: plantillaBienvenida(nombre),
    });

    if (error) {
      console.error("[email/bienvenida] Error Resend:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("[email/bienvenida] Error inesperado:", err);
    return NextResponse.json(
      { error: "Error interno al enviar email" },
      { status: 500 }
    );
  }
}
