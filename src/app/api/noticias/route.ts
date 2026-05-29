// Migrated from PHAROS [REF-800] — feed RSS de prensa canaria
// Read-only RSS aggregator. No DB. 15-min cache.

import { NextResponse } from "next/server";

const FUENTES = [
  {
    id: "eldiario-canarias",
    nombre: "elDiario.es · Canarias Ahora",
    url: "https://www.eldiario.es/rss/canariasahora/",
    logo: "📰",
  },
];

export type Noticia = {
  titulo: string;
  enlace: string;
  imagen: string | null;
  descripcion: string;
  fuente: string;
  fecha: string;
};

function extraerTag(xml: string, tag: string): string {
  const regexCDATA = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`
  );
  const matchCDATA = xml.match(regexCDATA);
  if (matchCDATA) return matchCDATA[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extraerImagen(itemXml: string): string | null {
  const enclosure = itemXml.match(/<enclosure[^>]+url="([^"]+)"/);
  if (enclosure) return enclosure[1];
  const media = itemXml.match(/<media:content[^>]+url="([^"]+)"/);
  if (media) return media[1];
  const thumb = itemXml.match(/<media:thumbnail[^>]+url="([^"]+)"/);
  if (thumb) return thumb[1];
  const image = itemXml.match(/<image[^>]*>([^<]+)<\/image>/);
  if (image) return image[1];
  const img = itemXml.match(/<img[^>]+src="([^"]+)"/);
  if (img) return img[1];
  return null;
}

function limpiarHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

async function parsearRSS(
  fuente: (typeof FUENTES)[number]
): Promise<Noticia[]> {
  try {
    const response = await fetch(fuente.url, {
      next: { revalidate: 900 },
      headers: { "User-Agent": "KOINOS-Platform/1.0 (noticias canarias)" },
    });

    if (!response.ok) return [];

    const xml = await response.text();

    const items = xml.split(/<item[\s>]/).slice(1);
    const entries = xml.split(/<entry[\s>]/).slice(1);
    const elementos = items.length > 0 ? items : entries;

    return elementos
      .slice(0, 15)
      .map((itemXml) => {
        const titulo = limpiarHtml(extraerTag(itemXml, "title"));
        const enlace =
          extraerTag(itemXml, "link") ||
          itemXml.match(/<link[^>]+href="([^"]+)"/)?.[1] ||
          "";
        const descripcion = limpiarHtml(
          extraerTag(itemXml, "description") || extraerTag(itemXml, "summary")
        );
        const imagen = extraerImagen(itemXml);
        const fecha =
          extraerTag(itemXml, "pubDate") ||
          extraerTag(itemXml, "updated") ||
          "";

        return {
          titulo,
          enlace,
          imagen,
          descripcion,
          fuente: fuente.nombre,
          fecha,
        };
      })
      .filter((n) => n.titulo && n.enlace);
  } catch {
    return [];
  }
}

export async function GET() {
  const todasLasNoticias: Noticia[] = [];
  const resultados = await Promise.all(FUENTES.map(parsearRSS));
  resultados.forEach((noticias) => todasLasNoticias.push(...noticias));

  todasLasNoticias.sort((a, b) => {
    const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
    const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
    return fechaB - fechaA;
  });

  return NextResponse.json({
    noticias: todasLasNoticias,
    actualizadoEn: new Date().toISOString(),
    fuentes: FUENTES.map((f) => f.nombre),
  });
}
