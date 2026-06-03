"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { INVITES_PER_USER } from "@/lib/constants";

const C = {
  bg: "#FAF7F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F3EFEC",
  border: "#E8E2DD",
  primary: "#FF6B6B",
  secondary: "#7C5CFC",
  accent: "#3DBBF0",
  text: "#2D2926",
  textMuted: "#7A7067",
  textDim: "#A89F97",
  semGreen: "#2ECC87",
  semYellow: "#FFB347",
  semRed: "#FF6B6B",
  gold: "#D4AF37",
};

type InviteSlot = {
  code: string;
  usedBy: string | null; // null = disponible, string = @handle que la usó
};

function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function InvitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<InviteSlot[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);

  // Carga las invitaciones reales del usuario + el @handle de quien las usó.
  async function cargar() {
    const supabase = supabaseBrowser();
    const { data: filas } = await supabase
      .from("invitations")
      .select("code, used_by")
      .order("created_at", { ascending: true });

    const usados = [
      ...new Set((filas ?? []).map((f) => f.used_by).filter(Boolean)),
    ] as string[];
    const handles: Record<string, string> = {};
    if (usados.length) {
      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, handle")
        .in("id", usados);
      for (const p of perfiles ?? []) handles[p.id] = p.handle;
    }
    setInvites(
      (filas ?? []).map((f) => ({
        code: f.code,
        usedBy: f.used_by ? "@" + (handles[f.used_by] ?? "alguien") : null,
      }))
    );
  }

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      await cargar();
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function generar() {
    setGenerando(true);
    try {
      const supabase = supabaseBrowser();
      await supabase.rpc("generar_invitaciones");
      await cargar();
    } finally {
      setGenerando(false);
    }
  }

  const usedCount = invites.filter((i) => i.usedBy !== null).length;

  async function copyCode(code: string, idx: number) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      // Fallback: select text approach or noop
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.textMuted,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        Cargando...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        padding: "40px 20px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Back link */}
        <Link
          href="/"
          style={{
            color: C.textMuted,
            fontSize: 14,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          &larr; Volver
        </Link>

        {/* Header */}
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: C.text,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Tus invitaciones
          </h1>
          <p style={{ color: C.textMuted, fontSize: 15, marginTop: 6 }}>
            Comparte OCRE con personas que valoras
          </p>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: C.textMuted,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              background: C.surfaceAlt,
              fontWeight: 700,
              fontSize: 13,
              color: C.text,
            }}
          >
            {usedCount}
          </span>
          <span>
            de {INVITES_PER_USER} invitaciones usadas
          </span>
        </div>

        {/* Invite slots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {invites.map((inv, idx) => (
            <div
              key={idx}
              style={{
                background: C.surface,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              {inv.usedBy ? (
                /* Used slot */
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: C.surfaceAlt,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      color: C.textDim,
                    }}
                  >
                    &#10003;
                  </div>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      Usada por{" "}
                      <span style={{ color: C.secondary }}>{inv.usedBy}</span>
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: C.textDim,
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
                      {inv.code}
                    </p>
                  </div>
                </div>
              ) : (
                /* Available slot */
                <>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `${C.semGreen}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: C.semGreen,
                        fontWeight: 700,
                      }}
                    >
                      &#9679;
                    </div>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: C.semGreen,
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        Disponible
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontFamily: "monospace",
                          letterSpacing: "0.04em",
                          color: C.text,
                          fontWeight: 500,
                          background: C.surfaceAlt,
                          padding: "4px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {inv.code}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyCode(inv.code, idx)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: copiedIdx === idx ? C.semGreen : C.surface,
                      color: copiedIdx === idx ? "#FFF" : C.text,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedIdx === idx ? "Copiado!" : "Copiar codigo"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Generar invitaciones (hasta el tope) */}
        {invites.length < INVITES_PER_USER && (
          <button
            onClick={generar}
            disabled={generando}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
              fontSize: 14,
              fontWeight: 600,
              cursor: generando ? "default" : "pointer",
              opacity: generando ? 0.6 : 1,
            }}
          >
            {generando
              ? "Generando…"
              : invites.length === 0
                ? "Generar mis invitaciones"
                : `Generar ${INVITES_PER_USER - invites.length} más`}
          </button>
        )}

        {/* Info box */}
        <div
          style={{
            background: `${C.secondary}0A`,
            borderRadius: 12,
            border: `1px solid ${C.secondary}20`,
            padding: "16px 18px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: C.textMuted,
            }}
          >
            Cada usuario recibe{" "}
            <strong style={{ color: C.text }}>{INVITES_PER_USER} codigos</strong>{" "}
            de invitacion. Compartelos con cuidado — tu reputacion esta
            vinculada a quien invitas.
          </p>
        </div>
      </div>
    </div>
  );
}
