"use client";

import { useState, useCallback } from "react";
import {
  Images,
  Newspaper,
  Landmark,
  PenLine,
  Heart,
  ChevronRight,
  BookOpen,
  Users,
  SlidersHorizontal,
  Library,
} from "lucide-react";

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

const TEAL = "#2ECC87";

interface OnboardingGuideProps {
  onComplete: () => void;
}

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);

  const totalSteps = 4;

  const goTo = useCallback(
    (next: number) => {
      if (animating || next === step) return;
      setDirection(next > step ? "next" : "prev");
      setAnimating(true);
      setTimeout(() => {
        setStep(next);
        setAnimating(false);
      }, 250);
    },
    [animating, step]
  );

  const next = () => {
    if (step < totalSteps - 1) goTo(step + 1);
  };

  const finish = () => {
    try {
      localStorage.setItem("KOINOS:onboarding_seen", "true");
    } catch {}
    onComplete();
  };

  const skip = () => finish();

  const slideStyle: React.CSSProperties = {
    transition: "opacity 0.25s ease, transform 0.25s ease",
    opacity: animating ? 0 : 1,
    transform: animating
      ? direction === "next"
        ? "translateX(40px)"
        : "translateX(-40px)"
      : "translateX(0)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Skip */}
      <button
        onClick={skip}
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          fontSize: 14,
          cursor: "pointer",
          zIndex: 10,
          padding: "4px 8px",
        }}
      >
        Saltar
      </button>

      <div
        style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Content */}
        <div style={{ ...slideStyle, width: "100%" }}>
          {step === 0 && <Screen1 onNext={next} />}
          {step === 1 && <Screen2 onNext={next} />}
          {step === 2 && <Screen3 onNext={next} />}
          {step === 3 && <Screen4 onFinish={finish} />}
        </div>

        {/* Dots */}
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  i === step ? C.primary : "rgba(255,255,255,0.25)",
                transition: "all 0.25s ease",
                cursor: "pointer",
              }}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: "28px 24px",
        width: "100%",
        color: C.text,
        fontSize: 14,
        lineHeight: 1.55,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "13px 0",
        background: C.primary,
        color: "#fff",
        border: "none",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 600,
        cursor: "pointer",
        marginTop: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {label}
      {label !== "\u00a1Listo!" && <ChevronRight size={16} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen 1                                                           */
/* ------------------------------------------------------------------ */

function Screen1({ onNext }: { onNext: () => void }) {
  const modes = [
    {
      name: "TOUCH",
      color: C.primary,
      icon: <Images size={18} color={C.primary} />,
      desc: "Tu \u00e1lbum privado. Guarda momentos, toca para descubrir.",
    },
    {
      name: "FEED",
      color: C.secondary,
      icon: <Newspaper size={18} color={C.secondary} />,
      desc: "Ideas y conversaciones. Escribe, comenta, descubre.",
    },
    {
      name: "POLIS",
      color: TEAL,
      icon: <Landmark size={18} color={TEAL} />,
      desc: "Tu barrio digital. Mapa, vecinos, comunidad.",
    },
  ];

  return (
    <Card>
      {/* Logo */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: -1,
          }}
        >
          <span style={{ color: C.primary }}>K</span>
          <span style={{ color: C.text }}>OINOS</span>
        </span>
      </div>

      <p
        style={{
          textAlign: "center",
          color: C.textMuted,
          fontSize: 14,
          margin: "0 0 20px",
        }}
      >
        Tu espacio social con tres dimensiones
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {modes.map((m) => (
          <div
            key={m.name}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background: C.surfaceAlt,
              borderRadius: 12,
              padding: "12px 14px",
              borderLeft: `3px solid ${m.color}`,
            }}
          >
            <div style={{ flexShrink: 0, marginTop: 2 }}>{m.icon}</div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: m.color,
                  marginBottom: 2,
                }}
              >
                {m.name}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{m.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <PrimaryButton label="Siguiente" onClick={onNext} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen 2                                                           */
/* ------------------------------------------------------------------ */

function Screen2({ onNext }: { onNext: () => void }) {
  const items = [
    {
      icon: <BookOpen size={18} color={C.secondary} />,
      title: "Escribir",
      desc: "Publica ideas, fotos, v\u00eddeos y citas",
    },
    {
      icon: <Users size={18} color={C.secondary} />,
      title: "Amigos",
      desc: "Timeline de tu red cerrada con hilos de comentarios",
    },
    {
      icon: <SlidersHorizontal size={18} color={C.secondary} />,
      title: "Algoritmo",
      desc: "Personaliza qu\u00e9 ves con pesos y filtros",
    },
    {
      icon: <Library size={18} color={C.secondary} />,
      title: "Biblioteca",
      desc: "Colecciones guardadas y contenido curado",
    },
  ];

  return (
    <Card>
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: 20,
          fontWeight: 700,
          textAlign: "center",
          color: C.text,
        }}
      >
        C\u00f3mo funciona{" "}
        <span style={{ color: C.secondary }}>FEED</span>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => (
          <div
            key={it.title}
            style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${C.secondary}14`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {it.icon}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 1 }}>
                {it.title}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{it.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Yapper callout */}
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          background: `${C.gold}12`,
          borderRadius: 10,
          border: `1px solid ${C.gold}33`,
          fontSize: 13,
          color: C.textMuted,
        }}
      >
        <span style={{ fontWeight: 600, color: C.gold }}>Yapper:</span>{" "}
        Activa &lsquo;Yapper&rsquo; para ver personajes hist\u00f3ricos
        opinando en tu feed.
      </div>

      <PrimaryButton label="Siguiente" onClick={onNext} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen 3                                                           */
/* ------------------------------------------------------------------ */

function Screen3({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <h2
        style={{
          margin: "0 0 20px",
          fontSize: 20,
          fontWeight: 700,
          textAlign: "center",
          color: C.text,
        }}
      >
        PEC vs Like
      </h2>

      <div style={{ display: "flex", gap: 12 }}>
        {/* Like */}
        <div
          style={{
            flex: 1,
            background: C.surfaceAlt,
            borderRadius: 14,
            padding: "18px 14px",
            textAlign: "center",
          }}
        >
          <Heart size={28} color={C.textDim} style={{ marginBottom: 8 }} />
          <div
            style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: C.textDim }}
          >
            Like
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.45 }}>
            An\u00f3nimo. Un +1 discreto.
          </div>
        </div>

        {/* PEC */}
        <div
          style={{
            flex: 1,
            background: C.surfaceAlt,
            borderRadius: 14,
            padding: "18px 14px",
            textAlign: "center",
          }}
        >
          {/* Overlapping circles */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 8,
              position: "relative",
              height: 28,
            }}
          >
            {[C.primary, C.secondary, C.accent].map((color, i) => (
              <div
                key={color}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: color,
                  border: `2px solid ${C.surfaceAlt}`,
                  marginLeft: i === 0 ? 0 : -8,
                  position: "relative",
                  zIndex: 3 - i,
                }}
              />
            ))}
          </div>
          <div
            style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: C.text }}
          >
            PEC
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.45 }}>
            Tu cara aparece. Endorsas con tu identidad.
          </div>
        </div>
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: 13,
          color: C.textMuted,
          marginTop: 16,
          marginBottom: 0,
          lineHeight: 1.5,
        }}
      >
        PEC es un compromiso visible. \u00dasalo cuando realmente resuene contigo.
      </p>

      <PrimaryButton label="Siguiente" onClick={onNext} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen 4                                                           */
/* ------------------------------------------------------------------ */

function Screen4({ onFinish }: { onFinish: () => void }) {
  return (
    <Card style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: `${C.primary}14`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <PenLine size={26} color={C.primary} />
      </div>

      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 20,
          fontWeight: 700,
          color: C.text,
        }}
      >
        Tu Diario
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          textAlign: "left",
          fontSize: 14,
          color: C.textMuted,
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: 0 }}>
          En la esquina superior derecha tienes tu{" "}
          <strong style={{ color: C.text }}>Diario personal</strong>.
        </p>
        <p style={{ margin: 0 }}>
          \u00dasalo como lista de tareas, notas r\u00e1pidas o seguimiento de ideas.
        </p>
        <p style={{ margin: 0, fontStyle: "italic", color: C.textDim }}>
          Solo t\u00fa lo ves. Se guarda en tu navegador.
        </p>
      </div>

      <PrimaryButton label={"\u00a1Listo!"} onClick={onFinish} />
    </Card>
  );
}
