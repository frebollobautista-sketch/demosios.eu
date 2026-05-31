// assets-base.js — base de assets pesados (sections_pack / osm-gc / osm-prov38).
//
// En PRODUCCIÓN los datos pesados (1,2 GB) se sirven desde Cloudflare R2
// (free tier, 0 € egress). index.html define `window.__ASSETS_BASE` con la
// URL pública del bucket SOLO cuando el host NO es local. En DEV local la
// variable queda '' y `assetUrl()` devuelve la ruta relativa tal cual, así
// que el runtime sigue leyendo de public/ sin tocar nada.
//
// Uso:
//   import { assetUrl } from "./assets-base.js";          // desde polis-app/
//   import { assetUrl } from "../assets-base.js";         // desde overlays/
//   fetch(assetUrl("../sections_pack/manifest.json"));    // conserva el ../
//
// IMPORTANTE: pasa la ruta relativa COMPLETA (incluido el "../"). Con
// ASSETS_BASE='' se devuelve intacta (relativa → funciona en local); con
// base real se le quita el "../" / "/" inicial y se antepone la URL del bucket.

export const ASSETS_BASE =
  (typeof window !== "undefined" && window.__ASSETS_BASE) || "";

export const assetUrl = (relPath) =>
  ASSETS_BASE
    ? `${ASSETS_BASE.replace(/\/$/, "")}/${relPath.replace(/^\.\.\//, "").replace(/^\//, "")}`
    : relPath;
