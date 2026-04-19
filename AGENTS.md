# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key things to remember on OCRE:

- We are on **Next.js 16.2.3 / React 19**. `params` and `searchParams` in page components are **Promises** — you must `await` them.
- App Router only. Layouts are Server Components by default; add `"use client"` only where you truly need state, effects, or browser APIs.
- For routes that should navigate instantly, export `unstable_instant` on the route. Don't rely on Suspense alone.
- Tailwind v4 uses the `@import "tailwindcss"` syntax and CSS-first theme config (`@theme inline { ... }`). No JS-based `tailwind.config.ts`.

## What OCRE is

**OCRE — Organización Canaria para la Recuperación de Espacios.** It is the civic front-end that exports the profile + gamified capital system we built in KOINOS (PHAROS sections as capital axes) into a one-stop shop for residents and small businesses in the Canary Islands, organised by island → municipio → barrio. The goal is to recover urban spaces virtually first: mapping which blocks are controlled by private-corporate accumulation versus which are commons.

## Sections

- **Inicio** — entry point and territorial navigator.
- **Ágora** — civic discussion (inherits PHAROS categories from KOINOS).
- **Bibliotheka** — two panes: **Cursus honorum** (citizen videos, graded by Greek civic ranks) and **Koiná** (τὰ κοινά — resources of the commons).
- **Polis** — map of spaces, capital composition of blocks.

## Shared components that must stay visible

- Top right, always: mail icon (subscribe), avatar icon (profile), settings icon.
- Bottom right, floating: avatar character showing level + class + points (the cursus honorum badge).
- Bottom, mobile only, collapsible: email subscription banner that reduces to a single mail icon.

## Captura del flow del chat

Cada vez que el usuario mencione una idea, pista o dirección que no acaba de operarse en el mismo turno — anótala en `docs/IDEAS.md` bajo la sección correspondiente, con la fecha y una línea de contexto. Nada del flow del chat se pierde aunque no se ejecute de inmediato. Releer `docs/IDEAS.md` al inicio de cada sesión larga para retomarlas.
