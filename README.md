# OCRE

**Organización Canaria para la Recuperación de Espacios.**

Web cívica que exporta desde KOINOS el perfil + sistema gamificado de capital (ejes PHAROS) y lo articula como un *one-stop shop* para vecinos y autónomos/PYMEs, navegable por **isla → municipio → barrio**.

## Arquitectura

Next.js 16 (App Router) + React 19 + Tailwind 4. Sin backend todavía: la data está en `src/lib/` para iterar la UI antes de conectar Supabase.

## Secciones

- `/` — **Inicio**: navegador territorial y estado del común.
- `/agora` — **Ágora**: discusión cívica por sección PHAROS.
- `/bibliotheka` — **Bibliotheka**: dos pestañas.
  - *Cursus honorum*: videos ciudadanos graduados (Polites → Archon).
  - *Koiná (τὰ κοινά)*: recursos del común.
- `/polis` — **Polis**: mapa de espacios y composición de capital por bloque.
- `/perfil` — perfil propio con stats de capital y nivel en el cursus.

## Desarrollo

```bash
npm install
npm run dev
```

## Documentación interna

- [`docs/CONCEPTO.md`](docs/CONCEPTO.md) — el para qué.
- [`docs/CURSUS_HONORUM.md`](docs/CURSUS_HONORUM.md) — los 7 grados y su mapeo a funciones profesionales reales.
- [`docs/CAPITAL.md`](docs/CAPITAL.md) — los tres ejes de capital y cómo se calculan sobre las 8 secciones PHAROS.
