// shared/taxonomia.js — Taxonomía cívica en primera persona.
//
// FUENTE DE VERDAD ÚNICA de las categorías del proyecto. La consumen (o
// consumirán) las cuatro caras: el mapa POLIS (capas/overlays), el feed
// de Ágora, el Descubre y un futuro buscador web. Cambias un verbo aquí,
// cambia en todas.
//
// 10 verbos en primera persona (lo que el ciudadano VIENE A HACER, no un
// sustantivo de área). Cada verbo abre un subgrid de "sectores". Cada
// sector declara su ORIGEN:
//   estado: "local"     → overlay cívico que ya tenemos en data/ (id + subcat?)
//   estado: "web"       → query a buscador web (HN/Wikipedia/OpenAlex/Brave) — aún "próximamente"
//   estado: "pendiente" → no hay fuente todavía
//
// Datos puros, autocontenido: NO importa nada (los glifos son propios,
// no dependen del GESTO_ART local de polis-app/app.js, que es scope de
// función e inalcanzable desde la hoja de gestos).

export const SECTOR_ESTADO = { LOCAL: "local", WEB: "web", PENDIENTE: "pendiente" };

// Line-art en polilíneas por verbo (stroke=currentColor → hereda el color
// de la tarjeta). Ilustra el verbo en vez del emoji. viewBox 48×32. Lo
// consume la hoja de gestos (#gestos-sheet) vía renderVerbos en app.js.
const _A = 'viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
export const VERBO_ART = {
  me_muevo: `<svg ${_A}><rect x="10" y="6" width="30" height="15" rx="2.5"/><line x1="10" y1="13.5" x2="40" y2="13.5"/><line x1="18" y1="6.5" x2="18" y2="13"/><line x1="26" y1="6.5" x2="26" y2="13"/><line x1="34" y1="6.5" x2="34" y2="13"/><circle cx="18" cy="25" r="3"/><circle cx="33" cy="25" r="3"/><line x1="2" y1="10" x2="7" y2="10"/><line x1="2" y1="15" x2="6" y2="15"/></svg>`,
  habito: `<svg ${_A}><path d="M8 16 L24 5 L40 16"/><path d="M12 16 V27 H36 V16"/><rect x="21" y="20" width="6" height="7"/></svg>`,
  me_cuido: `<svg ${_A}><path d="M3 17 H12 L15 10 L19 24 L22 17 H27"/><path d="M37 9 V23 M30 16 H44"/></svg>`,
  como: `<svg ${_A}><circle cx="24" cy="16" r="9"/><circle cx="24" cy="16" r="4.5"/><path d="M8 6 V14 M11 6 V14 M9.5 6 V26"/><path d="M40 6 q-3 4 0 8 V26"/></svg>`,
  disfruto: `<svg ${_A}><circle cx="13" cy="24" r="3.2"/><line x1="16.2" y1="24" x2="16.2" y2="8"/><path d="M16.2 8 q6 1 6 5.5"/><path d="M28 11 q3.5 5 0 10 M33 8 q5.5 8 0 16"/></svg>`,
  paseo: `<svg ${_A}><circle cx="16" cy="12" r="6.5"/><line x1="16" y1="18.5" x2="16" y2="27"/><circle cx="37" cy="8" r="3.2"/><path d="M3 28 q16 -5 42 0"/></svg>`,
  estudio: `<svg ${_A}><path d="M24 8 C18 4 9 5 5 7 V25 C9 23 18 22 24 26"/><path d="M24 8 C30 4 39 5 43 7 V25 C39 23 30 22 24 26"/><line x1="24" y1="8" x2="24" y2="26"/></svg>`,
  convivo: `<svg ${_A}><circle cx="16" cy="11" r="4"/><path d="M9 27 q0 -8 7 -8 q7 0 7 8"/><circle cx="32" cy="11" r="4"/><path d="M25 27 q0 -8 7 -8 q7 0 7 8"/></svg>`,
  trabajo: `<svg ${_A}><rect x="6" y="6" width="15" height="6" rx="1"/><line x1="13.5" y1="12" x2="22" y2="27"/><line x1="33" y1="7" x2="33" y2="26"/><line x1="29" y1="8" x2="37" y2="8"/></svg>`,
  participo: `<svg ${_A}><rect x="18" y="10" width="13" height="11" rx="2.5"/><path d="M21 10 v-3 M24.5 10 v-4 M28 10 v-3"/><path d="M18 14 q-3.5 1 -3 4.5"/><path d="M20 21 v8 M29 21 v8"/></svg>`,
};

// Claves de subcat verificadas contra los overlays:
//   alimentacion: ALIMENTACION_SUBCAT (overlays/alimentacion.js:19)
//   centros-salud: TIPO_STYLE keys (overlays/centros-salud.js:38)

export const TAXONOMIA = [
  {
    id: "me_muevo", verbo: "Me muevo", glifo: "🚶",
    sub: "Guagua · bici · a pie · parking",
    sectores: [
      { label: "Guagua",     glifo: "🚌", overlay: "guaguas",         estado: "local" },
      { label: "Titsa",      glifo: "🚏", overlay: "titsa",           estado: "local" },
      { label: "Bici / a pie", glifo: "🚲", overlay: "movilidad-suave", estado: "local" },
      { label: "Parking",    glifo: "🅿",  web: ["aparcamiento"],     estado: "web" },
      { label: "Taxi / compartir", glifo: "🚕",                       estado: "pendiente" }
    ]
  },
  {
    id: "habito", verbo: "Habito", glifo: "🏠",
    sub: "Vivienda · renta · alquiler",
    sectores: [
      { label: "Renta por zona", glifo: "📊", overlay: "renta",   estado: "local" },
      { label: "Vivienda / padrón", glifo: "⌂", overlay: "vv",    estado: "local" },
      { label: "Alquiler vivo",  glifo: "🔑",                     estado: "pendiente" },
      { label: "Precio €/m²",    glifo: "📐",                     estado: "pendiente" },
      { label: "Albergue / residencia", glifo: "🛏",              estado: "pendiente" }
    ]
  },
  {
    id: "me_cuido", verbo: "Me cuido", glifo: "🩺",
    sub: "Salud · bienestar",
    sectores: [
      { label: "Centro de salud", glifo: "➕", overlay: "centros-salud",
        subcat: ["centro_atencion_primaria", "consultorio_local"], estado: "local" },
      { label: "Hospital / urgencias", glifo: "🏥", overlay: "centros-salud",
        subcat: ["hospital", "urgencias"], estado: "local" },
      { label: "Farmacia",  glifo: "💊",                          estado: "pendiente" },
      { label: "Gimnasio",  glifo: "🏋", web: ["gimnasio"],       estado: "web" },
      { label: "Taller de bienestar", glifo: "🧘",                estado: "pendiente" }
    ]
  },
  {
    id: "como", verbo: "Como", glifo: "🍽",
    sub: "Comer local, sin cadenas",
    sectores: [
      { label: "Restaurante", glifo: "🍲", overlay: "alimentacion",
        subcat: ["restaurante"], excluirFlag: "franquicia", estado: "local" },
      { label: "Bar / café",  glifo: "☕", overlay: "alimentacion",
        subcat: ["bar", "cafe"], excluirFlag: "franquicia", estado: "local" },
      { label: "Mercadillo",  glifo: "🧺", overlay: "alimentacion",
        subcat: ["mercado"], estado: "local" },
      { label: "Productor local", glifo: "🧀", overlay: "productores", estado: "local" }
    ]
  },
  {
    id: "disfruto", verbo: "Disfruto", glifo: "🎭",
    sub: "Eventos · patrimonio · ocio",
    sectores: [
      { label: "Evento",        glifo: "🎉", overlay: "eventos",       estado: "local" },
      { label: "Patrimonio / BIC", glifo: "🏛", overlay: "bic",        estado: "local" },
      { label: "Concierto / taller", glifo: "🎫", web: ["eventbrite concierto"], estado: "web" },
      { label: "Senderismo",    glifo: "🥾", web: ["ruta senderismo"], estado: "web" }
    ]
  },
  {
    id: "paseo", verbo: "Paseo", glifo: "🌅",
    sub: "Aire libre · verde · calima",
    sectores: [
      { label: "Parque / zona verde", glifo: "🌳", overlay: "parques", estado: "local" },
      { label: "Ruta bici",   glifo: "🚲", overlay: "movilidad-suave", estado: "local" },
      { label: "Calima",      glifo: "🌫", overlay: "calima",          estado: "local" },
      { label: "Calidad del aire", glifo: "💨", overlay: "calidad-aire", estado: "local" },
      { label: "Playa",       glifo: "🏖", overlay: "playas",         estado: "local" }
    ]
  },
  {
    id: "estudio", verbo: "Estudio", glifo: "📚",
    sub: "Formación · becas",
    sectores: [
      { label: "Colegio / universidad", glifo: "🎓", overlay: "educacion", estado: "local" },
      { label: "Biblioteca",  glifo: "📖", overlay: "cultura-venues",  estado: "local" },
      { label: "Becas + formación", glifo: "💶", web: ["beca formación"], estado: "web" }
    ]
  },
  {
    id: "convivo", verbo: "Convivo", glifo: "🤝",
    sub: "Tejido social · asociaciones",
    sectores: [
      { label: "Asociaciones", glifo: "👥", overlay: "tejido-social",  estado: "local" },
      { label: "Registro cívico", glifo: "📋", overlay: "registro-oficial", estado: "local" },
      { label: "Eventos próximos", glifo: "📅", overlay: "eventos",     estado: "local" }
    ]
  },
  {
    id: "trabajo", verbo: "Trabajo", glifo: "💼",
    sub: "Empleo · reeducación",
    sectores: [
      { label: "Paro por zona", glifo: "📉", overlay: "paro",          estado: "local" },
      { label: "Ofertas de empleo", glifo: "📢",                       estado: "pendiente" },
      { label: "Formación / reeducación", glifo: "🔧", web: ["formación profesional empleo"], estado: "web" },
      { label: "Sector emergente", glifo: "🌱", web: ["sectores emergentes empleo Canarias"], estado: "web" }
    ]
  },
  {
    id: "participo", verbo: "Participo", glifo: "✊",
    sub: "Acción colectiva (Ágora)",
    sectores: [
      { label: "Convocar quórum", glifo: "📣", gesto: "convoco_quorum", destino: "../agora-app/", estado: "local" },
      { label: "Firmar convocatoria", glifo: "✍", gesto: "firmo_quorum", destino: "../agora-app/", estado: "local" },
      { label: "Acción colectiva", glifo: "🤝", destino: "../agora-app/", estado: "local" }
    ]
  }
];

export function getVerbo(id) {
  return TAXONOMIA.find(v => v.id === id) || null;
}
