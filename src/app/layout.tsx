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
    "Una ventanilla única para vecinos, autónomos y PYMEs en Canarias, organizada por isla, municipio y barrio. Fuera de las lógicas de acumulación y explotación del mercado.",
  applicationName: "OCRE",
  authors: [{ name: "Δημόσιος" }],
  keywords: [
    "Canarias",
    "común",
    "recuperación de espacios",
    "vivienda",
    "autónomos",
    "PYMEs",
    "cooperativismo",
    "Ágora",
    "Bibliotheka",
    "Polis",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "OCRE",
    title: "OCRE — Organización Canaria para la Recuperación de Espacios",
    description:
      "Recuperamos virtualmente el espacio antes de reclamarlo en la calle. Por isla, municipio y barrio.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OCRE",
    description:
      "Organización Canaria para la Recuperación de Espacios. Res publica, τὰ κοινά.",
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
