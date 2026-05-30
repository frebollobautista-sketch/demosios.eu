"use client";

import Link from "next/link";
import {
  Users,
  FileText,
  MessageCircle,
  Flag,
  Clock,
  Activity,
  Shield,
  Zap,
  UserPlus,
} from "lucide-react";
import { MAX_USERS } from "@/lib/constants";

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

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const METRICS = [
  {
    label: "Usuarios",
    value: 127,
    max: MAX_USERS,
    icon: Users,
    accent: C.secondary,
    showBar: true,
  },
  { label: "Posts hoy", value: 34, icon: FileText, accent: C.accent },
  { label: "Comentarios hoy", value: 89, icon: MessageCircle, accent: C.secondary },
  {
    label: "Reportes pendientes",
    value: 3,
    icon: Flag,
    accent: C.primary,
    warn: true,
    href: "/admin/reports",
  },
  { label: "Waitlist", value: 42, icon: UserPlus, accent: "#F59E0B" },
  { label: "PECs hoy", value: 156, icon: Zap, accent: "#10B981" },
];

const CHART_DATA = [
  { day: "Lun", v: 23 },
  { day: "Mar", v: 45 },
  { day: "Mie", v: 38 },
  { day: "Jue", v: 67 },
  { day: "Vie", v: 52 },
  { day: "Sab", v: 31 },
  { day: "Dom", v: 34 },
];
const CHART_MAX = Math.max(...CHART_DATA.map((d) => d.v));

const SIGNUPS = [
  { handle: "maria_g", name: "Maria Garcia", date: "12 abr", status: "activo" as const, color: "#FF6B6B" },
  { handle: "carlos99", name: "Carlos Ruiz", date: "12 abr", status: "activo" as const, color: "#7C5CFC" },
  { handle: "ana.dev", name: "Ana Torres", date: "12 abr", status: "pendiente" as const, color: "#3DBBF0" },
  { handle: "luisfer", name: "Luis Fernandez", date: "11 abr", status: "activo" as const, color: "#10B981" },
  { handle: "sofi_m", name: "Sofia Martinez", date: "11 abr", status: "activo" as const, color: "#F59E0B" },
  { handle: "diego.r", name: "Diego Romero", date: "11 abr", status: "pendiente" as const, color: "#FF6B6B" },
  { handle: "valeq", name: "Valentina Quiroz", date: "10 abr", status: "activo" as const, color: "#7C5CFC" },
  { handle: "pabloc", name: "Pablo Castillo", date: "10 abr", status: "activo" as const, color: "#3DBBF0" },
];

const SKIN_COLORS: Record<string, string> = {
  plain: C.textDim,
  yapper: "#F59E0B",
  devlog: "#10B981",
  nature: "#22C55E",
  photo: "#3DBBF0",
};

const POSTS = [
  { handle: "maria_g", text: "Acabo de terminar mi primer proyecto en React y estoy super contenta con el resultado!", skin: "yapper", likes: 12, pecs: 8, comments: 3, ago: "hace 5 min" },
  { handle: "carlos99", text: "Alguien sabe donde encontrar buen cafe de especialidad en CDMX? Recomendaciones bienvenidas", skin: "plain", likes: 7, pecs: 2, comments: 11, ago: "hace 12 min" },
  { handle: "ana.dev", text: "Nuevo devlog: implementando auth con Next.js middleware y Supabase RLS policies", skin: "devlog", likes: 23, pecs: 15, comments: 5, ago: "hace 28 min" },
  { handle: "luisfer", text: "Sunset desde el parque nacional. La naturaleza siempre sorprende con sus colores.", skin: "nature", likes: 45, pecs: 22, comments: 8, ago: "hace 1h" },
  { handle: "sofi_m", text: "Foto del dia: street photography en el centro historico, luces y sombras increibles", skin: "photo", likes: 31, pecs: 18, comments: 4, ago: "hace 2h" },
  { handle: "diego.r", text: "Hot take: TypeScript es el mejor lenguaje para startups en 2026 y no acepto debate", skin: "yapper", likes: 56, pecs: 34, comments: 27, ago: "hace 3h" },
];

const SYSTEM_ITEMS = [
  { label: "Base de datos", status: "operativa" },
  { label: "Storage", status: "operativo" },
  { label: "Auth", status: "operativo" },
  { label: "Edge Functions", status: "operativas" },
];

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const card: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  overflow: "hidden",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: C.text,
  marginBottom: 12,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 960, margin: "0 auto" }}>
      {/* Page title */}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "0 0 20px" }}>
        Dashboard
      </h1>

      {/* ---- Metrics grid ---- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          marginBottom: 28,
        }}
      >
        {METRICS.map((m) => {
          const Icon = m.icon;
          const isWarn = m.warn && m.value > 0;
          const inner = (
            <div
              style={{
                ...card,
                position: "relative",
                padding: "14px 14px 12px",
              }}
            >
              {/* accent bar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: isWarn ? C.primary : m.accent,
                  borderRadius: "12px 12px 0 0",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <Icon size={14} color={isWarn ? C.primary : m.accent} strokeWidth={2.2} />
                <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
                  {m.label}
                </span>
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: isWarn ? C.primary : C.text,
                  lineHeight: 1,
                }}
              >
                {m.value}
                {m.max != null && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textDim }}>
                    {" "}
                    / {m.max}
                  </span>
                )}
              </div>

              {/* progress bar for Usuarios */}
              {m.showBar && m.max != null && (
                <div
                  style={{
                    marginTop: 8,
                    height: 4,
                    borderRadius: 2,
                    background: C.surfaceAlt,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(m.value / m.max) * 100}%`,
                      height: "100%",
                      background: m.accent,
                      borderRadius: 2,
                      transition: "width .3s",
                    }}
                  />
                </div>
              )}
            </div>
          );

          return m.href ? (
            <Link key={m.label} href={m.href} style={{ textDecoration: "none" }}>
              {inner}
            </Link>
          ) : (
            <div key={m.label}>{inner}</div>
          );
        })}
      </div>

      {/* ---- Chart ---- */}
      <div style={{ ...card, padding: 16, marginBottom: 28 }}>
        <div style={sectionTitle}>
          <Activity
            size={14}
            color={C.secondary}
            strokeWidth={2.2}
            style={{ marginRight: 6, verticalAlign: -2 }}
          />
          Actividad ultimos 7 dias
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 0,
            height: 140,
            position: "relative",
          }}
        >
          {/* Y-axis labels */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              paddingRight: 8,
              minWidth: 24,
            }}
          >
            {[CHART_MAX, Math.round(CHART_MAX / 2), 0].map((v) => (
              <span key={v} style={{ fontSize: 9, color: C.textDim, lineHeight: 1 }}>
                {v}
              </span>
            ))}
          </div>

          {/* Bars */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-around",
              height: "100%",
              borderLeft: `1px solid ${C.border}`,
              borderBottom: `1px solid ${C.border}`,
              paddingBottom: 0,
            }}
          >
            {CHART_DATA.map((d) => (
              <div
                key={d.day}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                  gap: 4,
                }}
              >
                {/* bar */}
                <div
                  style={{
                    width: "60%",
                    maxWidth: 36,
                    height: `${(d.v / CHART_MAX) * 110}px`,
                    background: C.secondary,
                    borderRadius: "4px 4px 0 0",
                    position: "relative",
                    minHeight: 4,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: -16,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 9,
                      color: C.textMuted,
                      fontWeight: 600,
                    }}
                  >
                    {d.v}
                  </span>
                </div>
                {/* label */}
                <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Recent Signups ---- */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ padding: "14px 16px 10px", ...sectionTitle, marginBottom: 0 }}>
          <UserPlus
            size={14}
            color={C.accent}
            strokeWidth={2.2}
            style={{ marginRight: 6, verticalAlign: -2 }}
          />
          Ultimos registros
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: 480,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${C.border}`,
                  textAlign: "left",
                }}
              >
                {["Usuario", "Nombre", "Fecha", "Estado"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: C.textDim,
                      fontSize: 11,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIGNUPS.map((u) => (
                <tr
                  key={u.handle}
                  style={{ borderBottom: `1px solid ${C.surfaceAlt}` }}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: u.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {u.handle[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: C.text }}>@{u.handle}</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", color: C.textMuted }}>{u.name}</td>
                  <td style={{ padding: "8px 12px", color: C.textDim }}>{u.date}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background:
                          u.status === "activo"
                            ? "rgba(16,185,129,0.12)"
                            : "rgba(245,158,11,0.12)",
                        color: u.status === "activo" ? "#059669" : "#D97706",
                      }}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Recent Posts ---- */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ padding: "14px 16px 10px", ...sectionTitle, marginBottom: 0 }}>
          <FileText
            size={14}
            color={C.secondary}
            strokeWidth={2.2}
            style={{ marginRight: 6, verticalAlign: -2 }}
          />
          Ultimos posts
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: 560,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${C.border}`,
                  textAlign: "left",
                }}
              >
                {["Autor", "Contenido", "Skin", "Likes", "PECs", "Cmts", "Tiempo"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 10px",
                        fontWeight: 600,
                        color: C.textDim,
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {POSTS.map((p, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: `1px solid ${C.surfaceAlt}` }}
                >
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      color: C.text,
                      whiteSpace: "nowrap",
                    }}
                  >
                    @{p.handle}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: C.textMuted,
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.text.length > 60 ? p.text.slice(0, 60) + "..." : p.text}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: `${SKIN_COLORS[p.skin] || C.textDim}18`,
                        color: SKIN_COLORS[p.skin] || C.textDim,
                      }}
                    >
                      {p.skin}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: C.textMuted,
                      textAlign: "center",
                    }}
                  >
                    {p.likes}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: C.textMuted,
                      textAlign: "center",
                    }}
                  >
                    {p.pecs}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: C.textMuted,
                      textAlign: "center",
                    }}
                  >
                    {p.comments}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: C.textDim,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.ago}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- System Status ---- */}
      <div style={{ ...card, padding: 16 }}>
        <div style={sectionTitle}>
          <Shield
            size={14}
            color="#10B981"
            strokeWidth={2.2}
            style={{ marginRight: 6, verticalAlign: -2 }}
          />
          Estado del sistema
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
          }}
        >
          {SYSTEM_ITEMS.map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: C.textMuted,
              }}
            >
              <span style={{ color: "#10B981", fontSize: 14 }}>&#10003;</span>
              <span>
                {s.label}:{" "}
                <span style={{ color: "#059669", fontWeight: 600 }}>{s.status}</span>
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: C.textDim,
          }}
        >
          <Clock size={11} strokeWidth={2} />
          Ultima verificacion: hace 5 min
        </div>
      </div>
    </div>
  );
}
