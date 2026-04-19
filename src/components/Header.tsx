"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoOCRE } from "./LogoOCRE";
import {
  IconMail,
  IconUser,
  IconSettings,
  IconClose,
  IconChevronDown,
} from "./Icons";

type Seccion = { href: string; label: string };

const SECCIONES: Seccion[] = [
  { href: "/", label: "Inicio" },
  { href: "/agora", label: "Ágora" },
  { href: "/bibliotheka", label: "Bibliotheka" },
  { href: "/polis", label: "Polis" },
];

export function Header({ onOpenSubscribe }: { onOpenSubscribe: () => void }) {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          aria-label="OCRE — inicio"
        >
          <LogoOCRE />
        </Link>

        {/* Nav desktop */}
        <nav
          className="ml-6 hidden md:flex items-center gap-1"
          aria-label="Secciones principales"
        >
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="relative px-3 py-2 text-[0.93rem] rounded-md transition-colors"
              style={{
                color: isActive(s.href)
                  ? "var(--color-papiro-ink)"
                  : "var(--color-piedra)",
                fontWeight: isActive(s.href) ? 600 : 500,
              }}
            >
              {s.label}
              {isActive(s.href) && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-[17px] h-[2px]"
                  style={{ background: "var(--color-ocre-deep)" }}
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onOpenSubscribe}
            aria-label="Suscribirse al correo"
            title="Suscribirse"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
            style={{ color: "var(--color-piedra)" }}
          >
            <IconMail />
          </button>
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
          <button
            onClick={() => setOpenMobile((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={openMobile}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-papiro-soft)]"
            style={{ color: "var(--color-piedra)" }}
          >
            {openMobile ? <IconClose /> : <IconChevronDown />}
          </button>
        </div>
      </div>

      {/* Nav mobile colapsable */}
      {openMobile && (
        <nav
          className="md:hidden border-t"
          style={{ borderColor: "var(--color-linea)" }}
        >
          <ul className="max-w-6xl mx-auto px-4 py-2">
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  onClick={() => setOpenMobile(false)}
                  className="block py-2 text-[0.95rem]"
                  style={{
                    color: isActive(s.href)
                      ? "var(--color-ocre-deep)"
                      : "var(--color-papiro-ink)",
                    fontWeight: isActive(s.href) ? 600 : 500,
                  }}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
