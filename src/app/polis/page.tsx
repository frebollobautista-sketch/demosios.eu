"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Polis — visor cartográfico integrado en Next.js.
 *
 * Layout mobile-first:
 *   · Móvil:  mapa ocupa toda la pantalla; panel como bottom-sheet
 *             (arrastra hacia arriba para ver contenido futuro).
 *   · Desktop (≥768px): sidebar 320px a la izquierda, mapa ocupa el resto.
 *
 * El mapa se carga como iframe de /polis-provincia.html (MapLibre GL JS).
 * Shell Header se mantiene arriba; el contenido usa el alto restante.
 */

/* ── Altura del header (h-14 + nav ≈ 96px). Si cambia Header, ajustar. ── */
const HEADER_H = "96px";

/* ── Bottom sheet snap points (móvil) ── */
const SHEET_PEEK = 48;   // px visible cuando está cerrado
const SHEET_MID  = 280;  // px cuando está a medio abrir
const SHEET_FULL = 0.85; // fracción del viewport cuando está abierto

type SheetSnap = "closed" | "mid" | "full";

export default function PolisPage() {
  /* ── Bottom sheet state (móvil) ── */
  const [snap, setSnap] = useState<SheetSnap>("closed");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; h: number } | null>(null);
  const [sheetH, setSheetH] = useState(SHEET_PEEK);

  /* Resolve snap → px */
  const snapToPx = useCallback((s: SheetSnap) => {
    if (s === "closed") return SHEET_PEEK;
    if (s === "mid") return SHEET_MID;
    return Math.round(window.innerHeight * SHEET_FULL);
  }, []);

  /* Animate to snap */
  useEffect(() => {
    setSheetH(snapToPx(snap));
  }, [snap, snapToPx]);

  /* ── Touch drag handlers ── */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStart.current = { y: e.touches[0].clientY, h: sheetH };
  }, [sheetH]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStart.current) return;
    const dy = dragStart.current.y - e.touches[0].clientY;
    const next = Math.max(SHEET_PEEK, Math.min(
      Math.round(window.innerHeight * SHEET_FULL),
      dragStart.current.h + dy,
    ));
    setSheetH(next);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!dragStart.current) return;
    dragStart.current = null;
    // Snap to nearest
    const fullPx = Math.round(window.innerHeight * SHEET_FULL);
    if (sheetH > (SHEET_MID + fullPx) / 2) setSnap("full");
    else if (sheetH > (SHEET_PEEK + SHEET_MID) / 2) setSnap("mid");
    else setSnap("closed");
  }, [sheetH]);

  /* Toggle on tap of handle */
  const toggleSheet = useCallback(() => {
    setSnap((prev) => (prev === "closed" ? "mid" : "closed"));
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: `calc(100vh - ${HEADER_H})`, background: "#0a0a0a" }}
    >
      {/* ── Desktop sidebar (≥768px) ── */}
      <aside
        className="hidden md:flex flex-col absolute inset-y-0 left-0 z-10"
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-linea)",
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center gap-2 px-4 shrink-0"
          style={{
            height: 52,
            borderBottom: "1px solid var(--color-linea)",
          }}
        >
          <span
            className="display text-[1rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            Polis
          </span>
          <span
            className="eyebrow ml-auto"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Provincia de Las Palmas
          </span>
        </div>

        {/* Sidebar body — placeholder for future menus */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p
            className="text-[0.85rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            Navega el mapa: haz clic en una isla, luego en un municipio y en
            una sección censal para ver sus edificios en 3D.
          </p>

          <div className="divisor my-4" />

          <p
            className="text-[0.78rem]"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            709 secciones censales · 3 islas · Catastro + OSM · MapLibre GL
          </p>
        </div>

        {/* Sidebar footer */}
        <div
          className="shrink-0 px-4 py-3 text-[0.75rem]"
          style={{
            borderTop: "1px solid var(--color-linea)",
            color: "var(--color-piedra-clara)",
          }}
        >
          <a
            href="/polis-provincia.html"
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Abrir pantalla completa ↗
          </a>
        </div>
      </aside>

      {/* ── Map iframe ── */}
      <iframe
        src="/polis-provincia.html"
        title="Mapa KOINOS POLIS — Provincia de Las Palmas"
        className="absolute inset-0 h-full border-0 block
                   w-full md:left-[320px] md:w-[calc(100%-320px)]"
      />

      {/* ── Mobile bottom sheet (< 768px) ── */}
      <div
        ref={sheetRef}
        className="md:hidden fixed left-0 right-0 bottom-0 z-20"
        style={{
          height: sheetH,
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-linea)",
          borderRadius: "16px 16px 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
          transition: dragStart.current ? "none" : "height 0.3s cubic-bezier(.4,0,.2,1)",
          willChange: "height",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-center py-2 cursor-grab"
          onClick={toggleSheet}
        >
          <div
            className="rounded-full"
            style={{
              width: 36,
              height: 4,
              background: "var(--color-piedra-clara)",
              opacity: 0.5,
            }}
          />
        </div>

        {/* Sheet content */}
        <div className="px-4 pb-4 overflow-y-auto" style={{ height: "calc(100% - 28px)" }}>
          <p
            className="display text-[0.95rem] mb-2"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            Polis
          </p>
          <p
            className="text-[0.82rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            Navega el mapa: toca una isla, un municipio y una sección censal
            para ver edificios en 3D.
          </p>

          <div className="divisor my-3" />

          <p
            className="text-[0.75rem]"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            709 secciones · 3 islas · Catastro + OSM · MapLibre GL
          </p>
        </div>
      </div>
    </div>
  );
}
