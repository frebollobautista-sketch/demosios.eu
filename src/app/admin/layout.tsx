"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Moderaci\u00f3n", href: "/admin/reports" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          height: 54,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <span
          style={{
            fontWeight: 800,
            fontSize: 15,
            color: C.text,
            letterSpacing: 0.5,
          }}
        >
          Admin KOINOS
        </span>

        <nav style={{ display: "flex", gap: 6 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? C.primary : C.textMuted,
                  background: active ? C.surfaceAlt : "transparent",
                  textDecoration: "none",
                  transition: "all .15s",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/feed"
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: C.textDim,
            textDecoration: "none",
          }}
        >
          &larr; Volver al feed
        </Link>
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
