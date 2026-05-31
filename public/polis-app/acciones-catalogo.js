// acciones-catalogo.js — Catálogo canónico de gestos + chips + acciones
// para la "ventanilla única" POLIS. Ver docs/GESTOS-VENTANILLA-v1.md.
//
// Estructura:
//   GESTOS[]   — los 11 gestos verbales en primera persona
//   CHIPS{}    — un chip por indicador, con su gesto + acciones
//
// La grid del gesto se construye filtrando CHIPS por `gesto`. El chip
// cerrado pinta `chip.label` + `chip.metrica_viva`. El chip abierto pinta
// `ficha` + lista de `acciones`. Cada acción tiene `tipo` que el runtime
// despacha a su handler (enlace, telefono, filtro, formulario, etc.).
//
// v1: 3 indicadores piloto (centros-salud, comedores-escolares, subvenciones).
// El resto se va completando indicador a indicador conforme se valida con
// la consejería/ayuntamiento correspondiente.

export const GESTOS = [
  { id: "empadronarme", nombre: "Empadronarme", icon: "ocre:casa-terrera",
    sub: "Padrón · vivienda · IBI · bonificaciones" },
  { id: "cuidarme",     nombre: "Cuidarme",     icon: "+",
    sub: "Cita SCS · farmacia · dependencia · salud mental" },
  { id: "estudiar",     nombre: "Estudiar",     icon: "▤",
    sub: "Plazas · becas · comedor · formación · telecentros" },
  { id: "comer",        nombre: "Comer",        icon: "ocre:espiga-millo",
    sub: "Mercados · productores · huertos · ayudas" },
  { id: "trabajar",     nombre: "Trabajar",     icon: "⚒",
    sub: "Paro · ayudas empleo · formación · autoempleo" },
  { id: "moverme",      nombre: "Moverme",      icon: "ocre:guagua",
    sub: "Bonos · líneas · paradas · bici · recarga" },
  { id: "convivir",     nombre: "Convivir",     icon: "ocre:nudo-cesteria",
    sub: "Asociaciones · centros cívicos · vecinal" },
  { id: "disfrutar",    nombre: "Disfrutar",    icon: "ocre:timple",
    sub: "Eventos · cultura · playas · parques" },
  { id: "participar",   nombre: "Participar",   icon: "▲",
    sub: "Consultas · subvenciones · contratos · voto" },
  { id: "recordar",     nombre: "Recordar",     icon: "ocre:hoja-drago",
    sub: "Patrimonio · memoria · yacimientos · identidad" },
  { id: "avisar",       nombre: "Avisar",       icon: "⚠",
    sub: "Alertas · riesgos · reportar incidencia" }
];

// ---------------------------------------------------------------------------
// CHIPS — un objeto por indicador. Los 3 primeros son los piloto v1
// completamente definidos; el resto es esqueleto (gesto + label + icono)
// para validar el mapeo. Conforme se vayan validando se rellena `acciones`.
// ---------------------------------------------------------------------------

export const CHIPS = {
  // ════════════════════════════════════════════════════════════════════
  // PILOTOS v1 (completos)
  // ════════════════════════════════════════════════════════════════════

  "centros-salud": {
    id: "centros-salud",
    gesto: "cuidarme",
    chip: {
      label: "Centros de salud",
      icono: "ocre:salud-cruz",
      metrica_viva: {
        // Resolvedor: nº de centros AP en la sección actual + lista espera media
        // El runtime debe implementar resolveMetrica("centros-salud", state)
        formato_default: "${centros} centros · ${dias_espera}d esp.",
        formato_sin_dato: "—"
      }
    },
    ficha: {
      titulo: "Atención primaria SCS",
      descripcion: "Red pública de centros de salud, consultorios locales y servicios de urgencias del Servicio Canario de Salud.",
      que_mide: "Ubicación, especialidades, horario y lista de espera por zona básica.",
      fuente: {
        nombre: "SCS · Servicio Canario de Salud",
        url: "https://www3.gobiernodecanarias.org/sanidad/scs/",
        actualizado: "2026-05-15"
      }
    },
    acciones: [
      {
        tipo: "enlace",
        label: "Pedir cita SCS",
        url: "https://www3.gobiernodecanarias.org/sanidad/scs/cita_previa.html"
      },
      {
        tipo: "telefono",
        label: "Llamar al centro",
        valor_dinamico: "properties.telefono"
      },
      {
        tipo: "filtro",
        label: "Solo urgencias 24h",
        capa_secundaria: { id: "centros-salud", filter: { tipo: "urgencias" } }
      },
      {
        tipo: "filtro",
        label: "Solo hospitales",
        capa_secundaria: { id: "centros-salud", filter: { tipo: "hospital" } }
      },
      {
        tipo: "formulario_externo",
        label: "Reclamar tiempo de espera",
        url: "https://sede.gobcan.es/sede/procedimientos_servicios/tramites/queja-sugerencia"
      },
      {
        tipo: "enlace",
        label: "Mi tarjeta sanitaria",
        url: "https://www3.gobiernodecanarias.org/sanidad/scs/tarjeta_sanitaria"
      }
    ]
  },

  "comedores-escolares": {
    id: "comedores-escolares",
    gesto: "estudiar",
    chip: {
      label: "Comedor y becas",
      icono: "ocre:espiga-millo",
      metrica_viva: {
        formato_default: "${cobertura}% con comedor",
        formato_sin_dato: "—"
      }
    },
    ficha: {
      titulo: "Comedores escolares y becas",
      descripcion: "Tipo de comedor (gratuito, subvencionado, concertado), programa de desayuno y becas estatales por centro educativo.",
      que_mide: "Cobertura del servicio de comedor y posibilidad de beca por centro.",
      fuente: {
        nombre: "Consejería de Educación · Gobierno de Canarias",
        url: "https://www.gobiernodecanarias.org/educacion/web/",
        actualizado: "2026-05-27"
      }
    },
    acciones: [
      {
        tipo: "enlace",
        label: "Solicitar beca comedor",
        url: "https://www.gobiernodecanarias.org/educacion/web/estudiantes/becas_ayudas/"
      },
      {
        tipo: "enlace",
        label: "Solicitar beca estatal (MEC)",
        url: "https://www.becaseducacion.gob.es/"
      },
      {
        tipo: "filtro",
        label: "Solo gratuitos",
        capa_secundaria: { id: "comedores-escolares", filter: { tipo_comedor: "gratuito" } }
      },
      {
        tipo: "filtro",
        label: "Con programa desayuno",
        capa_secundaria: { id: "comedores-escolares", filter: { desayuno_disponible: true } }
      },
      {
        tipo: "telefono",
        label: "Llamar al centro",
        valor_dinamico: "properties.telefono"
      },
      {
        tipo: "formulario_externo",
        label: "Reclamación / queja",
        url: "https://sede.gobcan.es/sede/procedimientos_servicios/tramites/queja-sugerencia"
      }
    ]
  },

  "subvenciones": {
    id: "subvenciones",
    gesto: "participar",
    chip: {
      label: "Subvenciones",
      icono: "▲",
      metrica_viva: {
        formato_default: "${abiertas} abiertas · ${importe}€",
        formato_sin_dato: "0 abiertas"
      }
    },
    ficha: {
      titulo: "Subvenciones del Gobierno de Canarias",
      descripcion: "Convocatorias abiertas de ayudas, subvenciones y becas publicadas en el BOC, con plazo, importe y entidad beneficiaria.",
      que_mide: "Volumen de fondos públicos disponibles y plazos de solicitud abiertos en tu municipio.",
      fuente: {
        nombre: "BOC + Base de Datos Nacional de Subvenciones",
        url: "https://www.infosubvenciones.es/bdnstrans/GE/es/index",
        actualizado: "2026-05-27"
      }
    },
    acciones: [
      {
        tipo: "enlace",
        label: "Ver todas las convocatorias",
        url: "https://www.infosubvenciones.es/bdnstrans/GE/es/index"
      },
      {
        tipo: "enlace",
        label: "Buscador BOC",
        url: "https://www.gobiernodecanarias.org/boc/"
      },
      {
        tipo: "filtro",
        label: "Solo abiertas hoy",
        capa_secundaria: { id: "subvenciones", filter: { estado: "abierta" } }
      },
      {
        tipo: "filtro",
        label: "Para personas físicas",
        capa_secundaria: { id: "subvenciones", filter: { beneficiario: "personas_fisicas" } }
      },
      {
        tipo: "filtro",
        label: "Para entidades sin ánimo",
        capa_secundaria: { id: "subvenciones", filter: { beneficiario: "entidades_sin_animo" } }
      },
      {
        tipo: "enlace",
        label: "Cl@ve / certificado digital",
        url: "https://clave.gob.es/"
      }
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  // RESTO — esqueleto (gesto + label). `acciones` pendiente de validar
  // ════════════════════════════════════════════════════════════════════

  "vv":                   { id: "vv",                   gesto: "empadronarme", chip: { label: "Viviendas vacías",   icono: "ocre:casa-terrera" } },
  "renta":                { id: "renta",                gesto: "empadronarme", chip: { label: "Renta media",        icono: "€" } },
  "lista-espera":         { id: "lista-espera",         gesto: "cuidarme",     chip: { label: "Lista de espera",    icono: "⌛" } },
  "farmacias":            { id: "farmacias",            gesto: "cuidarme",     chip: { label: "Farmacias",          icono: "℞" } },
  "educacion":            { id: "educacion",            gesto: "estudiar",     chip: { label: "Centros educativos", icono: "▤" } },
  "telecentros":          { id: "telecentros",          gesto: "estudiar",     chip: { label: "Telecentros",        icono: "⌨" } },
  "productores":          { id: "productores",          gesto: "comer",        chip: { label: "Productores",        icono: "ocre:espiga-millo" } },
  "alimentacion":         { id: "alimentacion",         gesto: "comer",        chip: { label: "Comercio comida",    icono: "◉" } },
  "huertos":              { id: "huertos",              gesto: "comer",        chip: { label: "Huertos urbanos",    icono: "ocre:hoja-drago" } },
  "paro":                 { id: "paro",                 gesto: "trabajar",     chip: { label: "Paro registrado",    icono: "⚒" } },
  "guaguas":              { id: "guaguas",              gesto: "moverme",      chip: { label: "Guaguas",            icono: "ocre:guagua" } },
  "cobertura":            { id: "cobertura",            gesto: "moverme",      chip: { label: "Cobertura bus",      icono: "◌" } },
  "titsa":                { id: "titsa",                gesto: "moverme",      chip: { label: "Titsa",              icono: "ocre:guagua" } },
  "movilidad-suave":      { id: "movilidad-suave",      gesto: "moverme",      chip: { label: "Carriles bici",      icono: "⌒" } },
  "bici-recarga":         { id: "bici-recarga",         gesto: "moverme",      chip: { label: "Bici y recarga",     icono: "⚡" } },
  "tejido-social":        { id: "tejido-social",        gesto: "convivir",     chip: { label: "Asociaciones",       icono: "ocre:nudo-cesteria" } },
  "agora":                { id: "agora",                gesto: "convivir",     chip: { label: "Ágora",              icono: "ocre:calado" } },
  "centros-civicos":      { id: "centros-civicos",      gesto: "convivir",     chip: { label: "Centros cívicos",    icono: "⊕" } },
  "eventos":              { id: "eventos",              gesto: "disfrutar",    chip: { label: "Eventos",            icono: "ocre:timple" } },
  "cultura-venues":       { id: "cultura-venues",       gesto: "disfrutar",    chip: { label: "Sedes culturales",   icono: "♪" } },
  "registro":             { id: "registro",             gesto: "disfrutar",    chip: { label: "Registro cultural",  icono: "§" } },
  "parques":              { id: "parques",              gesto: "disfrutar",    chip: { label: "Parques",            icono: "✻" } },
  "playas":               { id: "playas",               gesto: "disfrutar",    chip: { label: "Playas",             icono: "≈" } },
  "mobiliario":           { id: "mobiliario",           gesto: "disfrutar",    chip: { label: "Mobiliario",         icono: "Bc" } },
  "arboles-singulares":   { id: "arboles-singulares",   gesto: "disfrutar",    chip: { label: "Árboles singulares", icono: "ocre:drago" } },
  "enp":                  { id: "enp",                  gesto: "disfrutar",    chip: { label: "Espacios protegidos", icono: "▲" } },
  "elecciones":           { id: "elecciones",           gesto: "participar",   chip: { label: "Resultados elecciones", icono: "▲" } },
  "contratos":            { id: "contratos",            gesto: "participar",   chip: { label: "Contratos públicos", icono: "§" } },
  "bic":                  { id: "bic",                  gesto: "recordar",     chip: { label: "Patrimonio BIC",     icono: "★" } },
  "memoria-democratica":  { id: "memoria-democratica",  gesto: "recordar",     chip: { label: "Memoria democrática", icono: "✊" } },
  "yacimientos":          { id: "yacimientos",          gesto: "recordar",     chip: { label: "Yacimientos",        icono: "ocre:hoja-drago" } },
  "barrios":              { id: "barrios",              gesto: "recordar",     chip: { label: "Barrios identitarios", icono: "▦" } },
  "calidad-aire":         { id: "calidad-aire",         gesto: "avisar",       chip: { label: "Calidad del aire",   icono: "Air" } },
  "calima":               { id: "calima",               gesto: "avisar",       chip: { label: "Calima",             icono: "≋" } },
  "inundacion":           { id: "inundacion",           gesto: "avisar",       chip: { label: "Inundación",         icono: "≈" } },
  "peligro-volcanico":    { id: "peligro-volcanico",    gesto: "avisar",       chip: { label: "Peligro volcánico",  icono: "⏧" } }
};

// Helper: devuelve los chips de un gesto, en orden estable.
export function chipsDeGesto(gestoId) {
  return Object.values(CHIPS).filter(c => c.gesto === gestoId);
}

// Helper: estado del chip a efectos de UI.
//   "completo"   → tiene ficha y acciones
//   "esqueleto"  → solo gesto + label (overlay funciona, ventanilla aún no)
//   "pendiente"  → no hay overlay en disco (capa atenuada)
export function estadoChip(chip, overlayDisponible) {
  if (!overlayDisponible) return "pendiente";
  if (chip.acciones && chip.acciones.length) return "completo";
  return "esqueleto";
}
