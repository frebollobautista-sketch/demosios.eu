"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoOCRE } from "./LogoOCRE";
import { IconMail, IconUser, IconSettings } from "./Icons";
import { useSession } from "@/lib/auth/useSession";

type Seccion = {
  href: string;
  label: string;
  alsoActive?: string[];
  /** Si está presente, se renderiza como dropdown con sub-entradas. */
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
 * Header en dos filas:
 *   · Fila 1 (siempre visible): logo + iconos usuario.
 *   · Fila 2: secciones principales. La entrada "Demos iOS" es un dropdown
 *     que en desktop se abre al click y en móvil se expande inline mostrando
 *     las sub-entradas en una segunda fila (scroll horizontal).
 *
 * Decisión 2026-05-09 con Panch: header se reduce a 3 entradas top-level
 * (Inicio · Demos iOS · Sobre OCRE). Consultorías y Canarias en Datos quedan
 * accesibles desde la home como 4 puertas, no desde el header.
 */
export function Header({ onOpenSubscribe }: { onOpenSubscribe: () => void }) {
  const pathname = usePathname();
  const { user, cargando } = useSession();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLLIElement>(null);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdown]);

  // Cerrar dropdown al cambiar ruta
  useEffect(() => {
    setOpenDropdown(null);
  }, [pathname]);

  const isActive = (s: Seccion) => {
    if (s.href === "/") return pathname === "/";
    if (pathname.startsWith(s.href)) return true;
    if (s.alsoActive?.some((p) => pathname.startsWith(p))) return true;
    return false;
  };

  return (
    <header
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
          {user && (
            <button
              onClick={onOpenSubscribe}
              aria-label="Suscribirse al correo"
              title="Suscribirse"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
              style={{ color: "var(--color-piedra)" }}
            >
              <IconMail />
            </button>
          )}
          {cargando || user ? (
            <>
              <Link
                href="/perfil"
                aria-label="Tu perfil"
                title="Perfil"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
                style={{ color: "var(--color-piedra)" }}
              >
                <IconUser />
              </Link>
              <Link
                href="/ajustes"
                aria-label="Ajustes"
                title="Ajustes"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
                style={{ color: "var(--color-piedra)" }}
              >
                <IconSettings />
              </Link>
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
              const abierto = openDropdown === s.href;

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
                <li
                  key={s.href}
                  className="shrink-0 relative"
                  ref={abierto ? dropdownRef : null}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(abierto ? null : s.href)
                    }
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
                    {s.label}
                    <span
                      aria-hidden
                      className="text-[0.7rem] transition-transform"
                      style={{
                        transform: abierto ? "rotate(180deg)" : "rotate(0)",
                      }}
                    >
                      ▾
                    </span>
                    {activo && <ActiveBar />}
                  </button>

                  {abierto && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full mt-1 z-40 min-w-[260px] rounded-lg shadow-lg overflow-hidden"
                      style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-linea)",
                      }}
                    >
                      <Link
                        href={s.href}
                        role="menuitem"
                        className="block px-4 py-3 text-[0.85rem] hover:bg-[var(--color-papiro-soft)] transition-colors"
                        style={{
                          color: "var(--color-papiro-ink)",
                          fontWeight: 600,
                          borderBottom: "1px solid var(--color-linea)",
                        }}
                      >
                        Ver {s.label} completo →
                      </Link>
                      {s.children!.map((c) => (
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
                    </div>
                  )}
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
