import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

const SITE_URL = "https://demosios.eu";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OCRE — Organización Canaria para la Recuperación de Espacios",
    template: "%s · OCRE",
  },
  description:
    "OCRE es el lobby cívico canario que acompaña a residentes, ayuntamientos, asociaciones y profesionales en la recuperación de espacios. Consultorías, datos abiertos de Canarias y recursos cívicos en demosios.eu.",
  applicationName: "OCRE · Demos iOS",
  authors: [{ name: "OCRE — Organización Canaria para la Recuperación de Espacios" }],
  keywords: [
    "OCRE",
    "Canarias",
    "datos abiertos Canarias",
    "vivienda vacacional",
    "consultoría cívica",
    "recuperación de espacios",
    "común",
    "vivienda",
    "autónomos",
    "PYMEs",
    "cooperativismo",
    "Demos iOS",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "OCRE · Demos iOS",
    title: "OCRE — Organización Canaria para la Recuperación de Espacios",
    description:
      "Lobby cívico canario. Consultorías, Canarias en Datos (visor abierto de la provincia 35), recursos cívicos y comunidad en demosios.eu.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OCRE · Demos iOS",
    description:
      "Organización Canaria para la Recuperación de Espacios. Consultorías, datos abiertos y recursos cívicos.",
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col papiro-grano">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
