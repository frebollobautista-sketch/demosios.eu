"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoOCRE } from "./LogoOCRE";
import { IconMail, IconUser, IconSettings } from "./Icons";
import { useSession } from "@/lib/auth/useSession";

type Seccion = {
  href: string;
  label: string;
  // Rutas adicionales bajo las que esta sección debe marcarse activa
  alsoActive?: string[];
};

const SECCIONES: Seccion[] = [
  { href: "/", label: "Inicio" },
  { href: "/consultorias", label: "Consultorías" },
  { href: "/canarias-en-datos", label: "Canarias en Datos" },
  {
    href: "/recursos",
    label: "Recursos",
    alsoActive: ["/agora", "/bibliotheka", "/polis"],
  },
  {
    href: "/sobre-ocre",
    label: "Sobre OCRE",
    alsoActive: ["/nosotros"],
  },
];

/**
 * Header en dos filas:
 *   · Fila 1 (siempre visible): logo del faro + nombre + iconos/acciones a la derecha.
 *   · Fila 2 (siempre visible): secciones principales como botones.
 *
 * En móvil la nav no se esconde detrás de un hamburguesa — queda visible
 * debajo, con scroll horizontal si hace falta. Así las funcionalidades
 * están siempre a un tap de distancia, incluso cuando los botones de
 * Entrar/Crear cuenta ocupan el lado derecho de la primera fila.
 */
export function Header({ onOpenSubscribe }: { onOpenSubscribe: () => void }) {
  const pathname = usePathname();
  const { user, cargando } = useSession();

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
          aria-label="Demos iOS — inicio"
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

      {/* Fila 2: secciones como botones — siempre visible, scroll horizontal en móvil */}
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
                    {activo && (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 -bottom-px h-[2px]"
                        style={{ background: "var(--color-ocre-deep)" }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}
