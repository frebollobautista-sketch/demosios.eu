import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

const SITE_URL = "https://demosios.eu";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Demosios — plataforma cívica de OCRE",
    template: "%s · Demosios",
  },
  description:
    "Demosios es la plataforma cívica de la Organización Canaria para la Recuperación de Espacios (OCRE). Ágora, Bibliotheka y Polis al servicio del común.",
  applicationName: "Demosios",
  authors: [{ name: "OCRE — Organización Canaria para la Recuperación de Espacios" }],
  keywords: [
    "Demosios",
    "OCRE",
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
    siteName: "Demosios by OCRE",
    title: "Demosios — plataforma cívica de OCRE",
    description:
      "Recuperamos virtualmente el espacio antes de reclamarlo en la calle. Ágora, Bibliotheka y Polis.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Demosios by OCRE",
    description:
      "Plataforma cívica de la Organización Canaria para la Recuperación de Espacios. Res publica, τὰ κοινά.",
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
