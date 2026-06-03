"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { MAX_USERS } from "@/lib/constants";

function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  // Conteo real de plazas ocupadas (perfiles existentes).
  const [currentUsers, setCurrentUsers] = useState<number>(0);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setCurrentUsers(count ?? 0));
  }, []);

  const isFull = currentUsers >= MAX_USERS;
  const pct = Math.min((currentUsers / MAX_USERS) * 100, 100);

  function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError("Introduce un email válido");
      return;
    }
    setEmailError("");
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: email.trim(), name: name.trim() || null });
    if (error) {
      // 23505 = clave duplicada: ya estaba apuntado. Lo tratamos como éxito.
      if (error.code === "23505") {
        setSubmitted(true);
        return;
      }
      setEmailError("No hemos podido apuntarte ahora. Inténtalo de nuevo.");
      return;
    }
    setSubmitted(true);
  }

  async function handleVerifyCode() {
    const code = inviteCode.trim();
    if (!code) return;
    setInviteStatus("checking");
    const supabase = supabaseBrowser();
    const { data: ok, error } = await supabase.rpc("validar_invitacion", {
      p_code: code,
    });
    if (error || !ok) {
      setInviteStatus("invalid");
      return;
    }
    setInviteStatus("valid");
    setTimeout(() => {
      window.location.href = `/registro?invite=${encodeURIComponent(code)}`;
    }, 1200);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${C.bg} 0%, #FFF5F5 50%, ${C.bg} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: 0,
              color: C.text,
            }}
          >
            <span style={{ color: C.primary }}>K</span>OINOS
          </h1>
          <p
            style={{
              color: C.textMuted,
              fontSize: 16,
              marginTop: 8,
              fontWeight: 400,
            }}
          >
            Tu espacio social con tres dimensiones
          </p>
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {[
            { label: "TOUCH", desc: "album privado", color: C.primary },
            { label: "FEED", desc: "ideas y conversaciones", color: C.secondary },
            { label: "POLIS", desc: "tu barrio digital", color: C.accent },
          ].map((f) => (
            <span
              key={f.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 20,
                background: C.surface,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                color: C.textMuted,
              }}
            >
              <span style={{ fontWeight: 700, color: f.color }}>{f.label}</span>
              <span style={{ color: C.textDim }}>{"·"}</span>
              <span>{f.desc}</span>
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ width: "100%", textAlign: "center" }}>
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 4,
              background: C.surfaceAlt,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 4,
                background: isFull
                  ? C.semRed
                  : `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>
            <strong style={{ color: C.text }}>{currentUsers}</strong> / {MAX_USERS} plazas
          </p>
        </div>

        {/* Form card */}
        <div
          style={{
            width: "100%",
            background: C.surface,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: 28,
          }}
        >
          {submitted ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#10003;</div>
              <p
                style={{
                  color: C.semGreen,
                  fontWeight: 600,
                  fontSize: 15,
                  margin: 0,
                }}
              >
                {isFull
                  ? "Te avisaremos cuando haya plaza en la siguiente ronda."
                  : "!Estas en la lista! Te avisaremos cuando haya plaza."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p
                style={{
                  fontSize: 15,
                  color: C.text,
                  fontWeight: 600,
                  margin: "0 0 16px",
                  textAlign: "center",
                }}
              >
                {isFull
                  ? "Todas las plazas estan ocupadas. Dejanos tu email para la proxima ronda."
                  : "Unete a la primera generacion"}
              </p>

              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${emailError ? C.semRed : C.border}`,
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: emailError ? 4 : 10,
                  background: C.bg,
                  color: C.text,
                }}
              />
              {emailError && (
                <p
                  style={{
                    color: C.semRed,
                    fontSize: 12,
                    margin: "0 0 10px",
                  }}
                >
                  {emailError}
                </p>
              )}

              <input
                type="text"
                placeholder="Tu nombre (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 14,
                  background: C.bg,
                  color: C.text,
                }}
              />

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "13px 0",
                  borderRadius: 10,
                  border: "none",
                  background: C.primary,
                  color: "#FFF",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLButtonElement).style.opacity = "0.9")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLButtonElement).style.opacity = "1")
                }
              >
                {isFull
                  ? "Avisadme cuando haya plaza"
                  : "Unirme a la lista de espera"}
              </button>
            </form>
          )}
        </div>

        {/* Invite code section */}
        <div style={{ width: "100%", textAlign: "center" }}>
          {!showInviteCode ? (
            <button
              onClick={() => setShowInviteCode(true)}
              style={{
                background: "none",
                border: "none",
                color: C.secondary,
                fontSize: 14,
                cursor: "pointer",
                textDecoration: "underline",
                fontWeight: 500,
              }}
            >
              Tienes un codigo de invitacion?
            </button>
          ) : (
            <div
              style={{
                background: C.surface,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: 20,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.text,
                  margin: "0 0 12px",
                }}
              >
                Introduce tu codigo
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="OCRE-XXXX-XXXX"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    if (inviteStatus !== "idle") setInviteStatus("idle");
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${
                      inviteStatus === "invalid" ? C.semRed : C.border
                    }`,
                    fontSize: 14,
                    fontFamily: "monospace",
                    letterSpacing: "0.05em",
                    outline: "none",
                    background: C.bg,
                    color: C.text,
                  }}
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={inviteStatus === "checking" || !inviteCode.trim()}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: C.secondary,
                    color: "#FFF",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: inviteStatus === "checking" ? "default" : "pointer",
                    opacity: inviteStatus === "checking" ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {inviteStatus === "checking" ? "Comprobando…" : "Verificar"}
                </button>
              </div>
              {inviteStatus === "valid" && (
                <p
                  style={{
                    color: C.semGreen,
                    fontSize: 13,
                    marginTop: 8,
                    fontWeight: 600,
                  }}
                >
                  Codigo valido! Redirigiendo...
                </p>
              )}
              {inviteStatus === "invalid" && (
                <p
                  style={{
                    color: C.semRed,
                    fontSize: 13,
                    marginTop: 8,
                    fontWeight: 600,
                  }}
                >
                  Codigo no valido
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: 20,
            justifyContent: "center",
            paddingTop: 16,
          }}
        >
          <Link
            href="/legal/terminos"
            style={{ color: C.textDim, fontSize: 13, textDecoration: "none" }}
          >
            Terminos
          </Link>
          <Link
            href="/legal/privacidad"
            style={{ color: C.textDim, fontSize: 13, textDecoration: "none" }}
          >
            Privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
