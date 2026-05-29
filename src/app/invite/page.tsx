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
  usedBy: string | null; // null = available, string = @handle
};

// Placeholder data — replace with real data from DB
const PLACEHOLDER_INVITES: InviteSlot[] = [
  { code: "KOINOS-A7K2-W9MX", usedBy: "@marina.dev" },
  { code: "KOINOS-B3F8-N4PL", usedBy: "@carlos.ui" },
  { code: "KOINOS-D5R1-H8QT", usedBy: null },
  { code: "KOINOS-G9J6-V2YC", usedBy: null },
  { code: "KOINOS-M4X0-E7LB", usedBy: null },
];

export default function InvitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invites] = useState<InviteSlot[]>(PLACEHOLDER_INVITES);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

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
          href="/feed"
          style={{
            color: C.textMuted,
            fontSize: 14,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          &larr; Volver al feed
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
            Comparte KOINOS con personas que valoras
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
