"use client";

import Link from "next/link";

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

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: C.surface, minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/feed"
          style={{
            color: C.text,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            fontSize: 20,
          }}
          aria-label="Volver al feed"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </Link>
        <span
          style={{
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "-0.02em",
            color: C.text,
          }}
        >
          KOINOS
        </span>
      </header>
      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "32px 20px 64px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
