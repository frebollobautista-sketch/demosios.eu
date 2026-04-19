import type { NextConfig } from "next";

/**
 * Fijamos la raíz de Turbopack al directorio del proyecto. Sin esto,
 * Next.js infiere la raíz buscando `package-lock.json` hacia arriba y
 * puede seleccionar un lockfile del home del usuario, emitiendo el
 * warning "multiple lockfiles".
 *
 * Ver: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
