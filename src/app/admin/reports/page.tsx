"use client";

import { useState } from "react";

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
};

/* ── Types ─────────────────────────────────────────────────────────── */

type ReportStatus = "pendiente" | "revisando" | "resuelto" | "descartado";
type ReportReason = "spam" | "acoso" | "odio" | "desinformación" | "otro";

interface Report {
  id: string;
  reporterAvatar: string;
  reporterHandle: string;
  contentPreview: string;
  reason: ReportReason;
  status: ReportStatus;
  timestamp: string;
  reportedUser: string;
}

/* ── Color maps ────────────────────────────────────────────────────── */

const REASON_COLORS: Record<ReportReason, { bg: string; text: string }> = {
  spam: { bg: "#E8E2DD", text: "#7A7067" },
  acoso: { bg: "#FFF0E0", text: "#E67E22" },
  odio: { bg: "#FFE0E0", text: "#E74C3C" },
  desinformación: { bg: "#FFF8E0", text: "#D4A017" },
  otro: { bg: "#E0EEFF", text: "#3498DB" },
};

const STATUS_COLORS: Record<ReportStatus, { bg: string; text: string }> = {
  pendiente: { bg: "#FFF8E0", text: "#D4A017" },
  revisando: { bg: "#E0EEFF", text: "#3498DB" },
  resuelto: { bg: "#E0F8EC", text: "#27AE60" },
  descartado: { bg: "#E8E2DD", text: "#7A7067" },
};

/* ── Placeholder data ──────────────────────────────────────────────── */

const PLACEHOLDER_REPORTS: Report[] = [
  {
    id: "r1",
    reporterAvatar: "MC",
    reporterHandle: "@mcarranza",
    contentPreview:
      "Este usuario est\u00e1 enviando enlaces sospechosos repetidamente en los comentarios del foro general...",
    reason: "spam",
    status: "pendiente",
    timestamp: "2026-04-12T09:14:00Z",
    reportedUser: "@spambot99",
  },
  {
    id: "r2",
    reporterAvatar: "LR",
    reporterHandle: "@lrosales",
    contentPreview:
      "Comentarios agresivos dirigidos a otros usuarios, incluyendo amenazas veladas y lenguaje intimidante...",
    reason: "acoso",
    status: "revisando",
    timestamp: "2026-04-11T22:45:00Z",
    reportedUser: "@toxicuser42",
  },
  {
    id: "r3",
    reporterAvatar: "AF",
    reporterHandle: "@aferrer",
    contentPreview:
      "Publicaci\u00f3n con discurso de odio contra un grupo \u00e9tnico espec\u00edfico, usando im\u00e1genes ofensivas...",
    reason: "odio",
    status: "pendiente",
    timestamp: "2026-04-11T18:30:00Z",
    reportedUser: "@hater_anon",
  },
  {
    id: "r4",
    reporterAvatar: "JP",
    reporterHandle: "@jperez",
    contentPreview:
      "Art\u00edculo compartido con informaci\u00f3n falsa sobre vacunas, citando fuentes no verificadas...",
    reason: "desinformación",
    status: "resuelto",
    timestamp: "2026-04-10T14:20:00Z",
    reportedUser: "@conspira_mx",
  },
  {
    id: "r5",
    reporterAvatar: "SG",
    reporterHandle: "@sgomez",
    contentPreview:
      "Contenido que no encaja en las categor\u00edas pero parece inapropiado para la plataforma...",
    reason: "otro",
    status: "descartado",
    timestamp: "2026-04-09T11:05:00Z",
    reportedUser: "@random_user",
  },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: colors.bg,
        color: colors.text,
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 8,
        border: `1px solid ${color}33`,
        background: `${color}14`,
        color,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Page ──────────────────────────────────────────────────────────── */

type FilterTab = "todos" | "pendientes" | "resueltos";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>(PLACEHOLDER_REPORTS);
  const [filter, setFilter] = useState<FilterTab>("todos");

  const filtered = reports.filter((r) => {
    if (filter === "pendientes") return r.status === "pendiente" || r.status === "revisando";
    if (filter === "resueltos") return r.status === "resuelto" || r.status === "descartado";
    return true;
  });

  const totalPending = reports.filter((r) => r.status === "pendiente" || r.status === "revisando").length;
  const totalResolved = reports.filter((r) => r.status === "resuelto").length;

  const updateStatus = (id: string, status: ReportStatus) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "pendientes", label: "Pendientes" },
    { key: "resueltos", label: "Resueltos" },
  ];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      {/* Title */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: C.text,
          margin: "0 0 20px",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        KOINOS &middot; Moderaci&oacute;n
      </h1>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Total reportes", value: reports.length, color: C.text },
          { label: "Pendientes", value: totalPending, color: C.semYellow },
          { label: "Resueltos hoy", value: totalResolved, color: C.semGreen },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              minWidth: 100,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "14px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: "7px 16px",
              borderRadius: 999,
              border: `1.5px solid ${filter === t.key ? C.primary : C.border}`,
              background: filter === t.key ? C.primary : C.surface,
              color: filter === t.key ? "#fff" : C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.textDim, fontSize: 14 }}>
            No hay reportes en esta categor&iacute;a.
          </div>
        )}
        {filtered.map((report) => (
          <div
            key={report.id}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 18,
            }}
          >
            {/* Reporter info */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: C.surfaceAlt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.textMuted,
                  border: `1px solid ${C.border}`,
                  flexShrink: 0,
                }}
              >
                {report.reporterAvatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {report.reporterHandle}
                </div>
                <div style={{ fontSize: 11, color: C.textDim }}>{fmtDate(report.timestamp)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Badge label={report.reason} colors={REASON_COLORS[report.reason]} />
                <Badge label={report.status} colors={STATUS_COLORS[report.status]} />
              </div>
            </div>

            {/* Content preview */}
            <div
              style={{
                fontSize: 13,
                color: C.textMuted,
                lineHeight: 1.5,
                marginBottom: 6,
                background: C.surfaceAlt,
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <span style={{ fontSize: 11, color: C.textDim }}>
                Reportado: {report.reportedUser}
              </span>
              <br />
              {report.contentPreview.length > 120
                ? report.contentPreview.slice(0, 120) + "..."
                : report.contentPreview}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <ActionBtn label="Revisar" color={C.accent} onClick={() => updateStatus(report.id, "revisando")} />
              <ActionBtn label="Resolver" color={C.semGreen} onClick={() => updateStatus(report.id, "resuelto")} />
              <ActionBtn label="Descartar" color={C.textMuted} onClick={() => updateStatus(report.id, "descartado")} />
              <ActionBtn label="Shadow ban usuario" color={C.semRed} onClick={() => alert(`Shadow ban: ${report.reportedUser}`)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
