"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoOCRE } from "./LogoOCRE";
import { IconMail, IconUser, IconSettings } from "./Icons";
import { LogoutButton } from "./LogoutButton";
import { useSession } from "@/lib/auth/useSession";

type Seccion = {
  href: string;
  label: string;
  alsoActive?: string[];
  children?: { href: string; label: string; descripcion?: string }[];
};

const SECCIONES: Seccion[] = [
  { href: "/", label: "Inicio" },
  {
    href: "/demos-ios",
    label: "Demos iOS",
    alsoActive: ["/recursos", "/stoa", "/agora", "/bibliotheka", "/polis"],
    children: [
      {
        href: "/stoa",
        label: "STOA",
        descripcion: "Patio cívico — actividad ligera del día a día",
      },
      {
        href: "/agora",
        label: "Ágora",
        descripcion: "Deliberación por las 8 secciones PHAROS",
      },
      {
        href: "/bibliotheka",
        label: "Bibliotheka",
        descripcion: "Cursus honorum + recursos comunes",
      },
      {
        href: "/polis",
        label: "POLIS",
        descripcion: "Mapa que se traza entre vecinos",
      },
    ],
  },
  {
    href: "/sobre-ocre",
    label: "Sobre OCRE",
    alsoActive: ["/nosotros"],
  },
];

/**
 * Header con dos filas:
 *   · Fila 1: logo + acciones usuario (Buzón ✉️ + Tu cuenta 👤 — ambos dropdowns).
 *   · Fila 2: secciones top-level (Inicio · Demos iOS ▾ · Sobre OCRE).
 *
 * Decisión 2026-05-09 con Panch: los iconos de mail y avatar pasan a ser
 * dropdowns con TODAS las opciones visibles (aunque algunas sean
 * "próximamente"), porque sin eso no se puede validar el flujo end-to-end.
 */
export function Header({ onOpenSubscribe }: { onOpenSubscribe: () => void }) {
  const pathname = usePathname();
  const { user, cargando } = useSession();
  const [openMenu, setOpenMenu] = useState<
    null | "demosios" | "buzon" | "cuenta"
  >(null);
  const navRef = useRef<HTMLElement>(null);

  // Cerrar dropdown al click fuera (incluye dropdowns portalizados)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (navRef.current && navRef.current.contains(target)) return;
      // El dropdown de Demos iOS vive en document.body via portal.
      // Si el click cae dentro de él, no cerramos.
      const portalEl = document.querySelector("[data-dropdown-demosios]");
      if (portalEl && portalEl.contains(target)) return;
      setOpenMenu(null);
    }
    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu]);

  // Cerrar dropdown al cambiar ruta
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const isActive = (s: Seccion) => {
    if (s.href === "/") return pathname === "/";
    if (pathname.startsWith(s.href)) return true;
    if (s.alsoActive?.some((p) => pathname.startsWith(p))) return true;
    return false;
  };

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-30 border-b"
      style={{
        borderColor: "var(--color-linea)",
        background:
          "linear-gradient(180deg, var(--color-surface) 0%, var(--color-papiro) 100%)",
        backdropFilter: "saturate(1.1)",
      }}
    >
      {/* Fila 1: logo + acciones usuario */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          aria-label="OCRE — inicio"
        >
          <LogoOCRE size={26} />
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          {cargando || user ? (
            <>
              {/* Buzón ✉️ — dropdown con 3 pestañas */}
              <BuzonDropdown
                abierto={openMenu === "buzon"}
                onToggle={() =>
                  setOpenMenu(openMenu === "buzon" ? null : "buzon")
                }
                onOpenSubscribe={onOpenSubscribe}
                userId={user?.id}
              />

              {/* Tu cuenta 👤 — dropdown con perfil + ajustes + cerrar sesión */}
              <CuentaDropdown
                abierto={openMenu === "cuenta"}
                onToggle={() =>
                  setOpenMenu(openMenu === "cuenta" ? null : "cuenta")
                }
                handle={user?.user_metadata?.handle as string | undefined}
                email={user?.email}
              />
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="text-[0.85rem] font-medium px-2.5 py-1.5 rounded-md hover:bg-[var(--color-papiro-soft)]"
                style={{ color: "var(--color-papiro-ink)" }}
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="text-[0.85rem] font-semibold px-2.5 py-1.5 rounded-md"
                style={{
                  background: "var(--color-ocre-deep)",
                  color: "var(--color-surface)",
                }}
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: secciones top-level */}
      <nav
        aria-label="Secciones principales"
        className="border-t"
        style={{ borderColor: "var(--color-linea)" }}
      >
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          <ul
            className="flex items-center gap-1 overflow-x-auto no-scrollbar"
            style={{
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {SECCIONES.map((s) => {
              const activo = isActive(s);
              const tieneChildren = !!s.children?.length;
              const abierto = openMenu === "demosios" && tieneChildren;

              if (!tieneChildren) {
                return (
                  <li key={s.href} className="shrink-0">
                    <Link
                      href={s.href}
                      className="relative inline-block px-3 py-2.5 text-[0.9rem] rounded-md transition-colors whitespace-nowrap"
                      style={{
                        color: activo
                          ? "var(--color-papiro-ink)"
                          : "var(--color-piedra)",
                        fontWeight: activo ? 600 : 500,
                      }}
                    >
                      {s.label}
                      {activo && <ActiveBar />}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={s.href} className="shrink-0">
                  <DropdownDemosIos
                    seccion={s}
                    activo={activo}
                    abierto={abierto}
                    onToggle={() =>
                      setOpenMenu(openMenu === "demosios" ? null : "demosios")
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}

function ActiveBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-3 -bottom-px h-[2px]"
      style={{ background: "var(--color-ocre-deep)" }}
    />
  );
}

/* ─────────── Dropdown "Demos iOS" — usa portal ─────────── */

/**
 * El menú se renderiza con createPortal a document.body porque el <ul>
 * padre tiene overflow-x: auto (scroll horizontal en móvil) que en CSS
 * fuerza overflow-y: auto, clippeando cualquier dropdown absolute. El
 * portal evita el clipping y posicionamos con getBoundingClientRect.
 */
function DropdownDemosIos({
  seccion,
  activo,
  abierto,
  onToggle,
}: {
  seccion: Seccion;
  activo: boolean;
  abierto: boolean;
  onToggle: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!abierto || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
    // Si el usuario hace scroll, cerramos para no quedar desfasado.
    const onScroll = () => onToggle();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [abierto, onToggle]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-haspopup="true"
        className="relative inline-flex items-center gap-1 px-3 py-2.5 text-[0.9rem] rounded-md transition-colors whitespace-nowrap"
        style={{
          color: activo
            ? "var(--color-papiro-ink)"
            : "var(--color-piedra)",
          fontWeight: activo ? 600 : 500,
        }}
      >
        {seccion.label}
        <span
          aria-hidden
          className="text-[0.7rem] transition-transform"
          style={{
            transform: abierto ? "rotate(180deg)" : "rotate(0)",
            display: "inline-block",
          }}
        >
          ▾
        </span>
        {activo && <ActiveBar />}
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div
            role="menu"
            data-dropdown-demosios
            className="fixed z-[60] min-w-[260px] rounded-lg shadow-lg overflow-hidden"
            style={{
              top: pos.top,
              left: pos.left,
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
            }}
          >
            <Link
              href={seccion.href}
              role="menuitem"
              className="block px-4 py-3 text-[0.85rem] hover:bg-[var(--color-papiro-soft)] transition-colors"
              style={{
                color: "var(--color-papiro-ink)",
                fontWeight: 600,
                borderBottom: "1px solid var(--color-linea)",
              }}
            >
              Ver {seccion.label} completo →
            </Link>
            {seccion.children!.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                role="menuitem"
                className="block px-4 py-3 hover:bg-[var(--color-papiro-soft)] transition-colors"
              >
                <div
                  className="text-[0.92rem]"
                  style={{
                    color: "var(--color-papiro-ink)",
                    fontWeight: 600,
                  }}
                >
                  {c.label}
                </div>
                {c.descripcion && (
                  <div
                    className="text-[0.78rem] mt-0.5"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {c.descripcion}
                  </div>
                )}
              </Link>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ─────────── Buzón ✉️ ─────────── */

type ConversacionMini = {
  id: string;
  titulo: string;
  preview: string;
  no_leidos: boolean;
  fecha: string;
};

function BuzonDropdown({
  abierto,
  onToggle,
  onOpenSubscribe,
  userId,
}: {
  abierto: boolean;
  onToggle: () => void;
  onOpenSubscribe: () => void;
  userId?: string;
}) {
  const [tab, setTab] = useState<"mensajes" | "notificaciones" | "boletin">(
    "mensajes",
  );
  const [convs, setConvs] = useState<ConversacionMini[] | null>(null);
  const [noLeidosCount, setNoLeidosCount] = useState(0);

  // Cargar mensajes al abrir o cambiar a la pestaña Mensajes
  useEffect(() => {
    if (!userId || !abierto || tab !== "mensajes") return;
    let activo = true;
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const { getMisConversaciones } = await import("@/lib/mensajes/queries");
      const supabase = createClient();
      const lista = await getMisConversaciones(supabase, userId);
      if (!activo) return;
      const mini = lista.slice(0, 5).map((c) => ({
        id: c.id,
        titulo:
          c.tipo === "grupo"
            ? c.nombre || "Grupo"
            : c.otro
              ? `@${c.otro.handle}`
              : "Conversación",
        preview: c.ultimo_mensaje?.cuerpo || "(sin mensajes)",
        no_leidos: c.no_leidos,
        fecha: c.ultimo_mensaje_at,
      }));
      setConvs(mini);
      setNoLeidosCount(lista.filter((c) => c.no_leidos).length);
    })();
    return () => {
      activo = false;
    };
  }, [userId, abierto, tab]);

  // Badge global: cuando se monta y al cambiar userId
  useEffect(() => {
    if (!userId) return;
    let activo = true;
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const { getNoLeidosCount } = await import("@/lib/mensajes/queries");
      const supabase = createClient();
      const n = await getNoLeidosCount(supabase, userId);
      if (activo) setNoLeidosCount(n);
    })();
    return () => {
      activo = false;
    };
  }, [userId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-label={
          noLeidosCount > 0
            ? `Buzón (${noLeidosCount} sin leer)`
            : "Buzón"
        }
        title="Buzón"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
        style={{ color: "var(--color-piedra)" }}
      >
        <IconMail />
        {noLeidosCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full text-[0.6rem] font-bold tabular-nums"
            style={{
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              background: "var(--color-ocre-deep)",
              color: "var(--color-surface)",
              border: "1px solid var(--color-surface)",
            }}
          >
            {noLeidosCount > 9 ? "9+" : noLeidosCount}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-lg shadow-lg overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          {/* Tabs */}
          <div
            className="flex"
            style={{ borderBottom: "1px solid var(--color-linea)" }}
          >
            <BuzonTab activo={tab === "mensajes"} onClick={() => setTab("mensajes")}>
              Mensajes{noLeidosCount > 0 ? ` (${noLeidosCount})` : ""}
            </BuzonTab>
            <BuzonTab
              activo={tab === "notificaciones"}
              onClick={() => setTab("notificaciones")}
            >
              Avisos
            </BuzonTab>
            <BuzonTab activo={tab === "boletin"} onClick={() => setTab("boletin")}>
              Boletín
            </BuzonTab>
          </div>

          {/* Contenido */}
          <div className="min-h-[120px]">
            {tab === "mensajes" && (
              <div>
                {convs === null ? (
                  <p
                    className="text-center py-6 text-[0.85rem]"
                    style={{ color: "var(--color-piedra-clara)" }}
                  >
                    Cargando…
                  </p>
                ) : convs.length === 0 ? (
                  <BuzonVacio texto="Aún no tienes conversaciones." />
                ) : (
                  <ul>
                    {convs.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/mensajes/${c.id}`}
                          className="block px-3 py-2.5 hover:bg-[var(--color-papiro-soft)] transition-colors"
                          style={{
                            borderBottom: "1px solid var(--color-linea)",
                          }}
                        >
                          <div className="flex items-baseline gap-2">
                            <span
                              className="text-[0.88rem] truncate flex-1"
                              style={{
                                color: "var(--color-papiro-ink)",
                                fontWeight: c.no_leidos ? 700 : 600,
                              }}
                            >
                              {c.titulo}
                              {c.no_leidos && (
                                <span
                                  aria-hidden
                                  className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle"
                                  style={{ background: "var(--color-ocre-deep)" }}
                                />
                              )}
                            </span>
                          </div>
                          <p
                            className="text-[0.78rem] truncate mt-0.5"
                            style={{ color: "var(--color-piedra)" }}
                          >
                            {c.preview}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/mensajes"
                  className="block text-center px-3 py-2.5 text-[0.82rem] hover:bg-[var(--color-papiro-soft)] transition-colors"
                  style={{
                    color: "var(--color-ocre-deep)",
                    fontWeight: 600,
                  }}
                >
                  Ver todas las conversaciones →
                </Link>
              </div>
            )}
            {tab === "notificaciones" && (
              <div className="p-4">
                <BuzonVacio
                  texto="Aquí aparecerán las respuestas a tus hilos, los PEC que recibas y las menciones."
                  badge="Próximamente"
                />
              </div>
            )}
            {tab === "boletin" && (
              <div className="p-4 text-[0.88rem]">
                <p
                  className="mb-3"
                  style={{ color: "var(--color-piedra)", lineHeight: 1.5 }}
                >
                  Recibe el resumen semanal de OCRE: novedades de Canarias en
                  Datos, hilos destacados de Ágora, recursos nuevos en
                  Bibliotheka.
                </p>
                <button
                  type="button"
                  onClick={onOpenSubscribe}
                  className="w-full px-3 py-2 rounded-md text-[0.85rem] font-semibold"
                  style={{
                    background: "var(--color-ocre-deep)",
                    color: "var(--color-surface)",
                  }}
                >
                  Configurar suscripción
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BuzonTab({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 px-3 py-2.5 text-[0.82rem] transition-colors"
      style={{
        color: activo ? "var(--color-papiro-ink)" : "var(--color-piedra)",
        fontWeight: activo ? 600 : 500,
        borderBottom: activo
          ? "2px solid var(--color-ocre-deep)"
          : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function BuzonVacio({ texto, badge }: { texto: string; badge?: string }) {
  return (
    <div className="text-center py-4">
      {badge && (
        <span
          className="inline-block text-[0.65rem] tracking-wider px-2 py-0.5 rounded mb-3"
          style={{
            background: "var(--color-papiro-soft)",
            color: "var(--color-piedra)",
            textTransform: "uppercase",
          }}
        >
          {badge}
        </span>
      )}
      <p
        className="text-[0.85rem]"
        style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
      >
        {texto}
      </p>
    </div>
  );
}

/* ─────────── Tu cuenta 👤 ─────────── */

function CuentaDropdown({
  abierto,
  onToggle,
  handle,
  email,
}: {
  abierto: boolean;
  onToggle: () => void;
  handle?: string;
  email?: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-label="Tu cuenta"
        title="Tu cuenta"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
        style={{ color: "var(--color-piedra)" }}
      >
        <IconUser />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-40 w-[260px] max-w-[calc(100vw-2rem)] rounded-lg shadow-lg overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          {/* Cabecera */}
          <div
            className="px-4 py-3"
            style={{
              background: "var(--color-papiro-soft)",
              borderBottom: "1px solid var(--color-linea)",
            }}
          >
            <div
              className="text-[0.92rem]"
              style={{
                color: "var(--color-papiro-ink)",
                fontWeight: 600,
              }}
            >
              {handle ? `@${handle}` : "Tu cuenta"}
            </div>
            {email && (
              <div
                className="text-[0.75rem] truncate mt-0.5"
                style={{ color: "var(--color-piedra)" }}
                title={email}
              >
                {email}
              </div>
            )}
          </div>

          {/* Opciones */}
          <CuentaItem href="/perfil" label="Mi perfil" />
          <CuentaItem
            href="/perfil/hilos"
            label="Mis hilos"
            soon
          />
          <CuentaItem
            href="/perfil/recursos"
            label="Mis recursos"
            soon
          />
          <CuentaItem
            href="/perfil/polis"
            label="Mis trazos POLIS"
            soon
          />
          <div style={{ borderTop: "1px solid var(--color-linea)" }} />
          <CuentaItem
            href="/ajustes"
            label="Ajustes"
            icono={<IconSettings />}
          />
          <div style={{ borderTop: "1px solid var(--color-linea)" }} />
          <LogoutButton variant="menu" onLoggedOut={onToggle} />
        </div>
      )}
    </div>
  );
}

function CuentaItem({
  href,
  label,
  icono,
  soon,
}: {
  href: string;
  label: string;
  icono?: React.ReactNode;
  soon?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center justify-between px-4 py-2.5 text-[0.92rem] hover:bg-[var(--color-papiro-soft)] transition-colors"
      style={{ color: "var(--color-papiro-ink)" }}
    >
      <span className="flex items-center gap-2.5">
        {icono && <span style={{ color: "var(--color-piedra)" }}>{icono}</span>}
        {label}
      </span>
      {soon && (
        <span
          className="text-[0.65rem] tracking-wider px-1.5 py-0.5 rounded"
          style={{
            background: "var(--color-papiro-soft)",
            color: "var(--color-piedra)",
            textTransform: "uppercase",
          }}
        >
          Próx.
        </span>
      )}
    </Link>
  );
}
