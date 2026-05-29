// Sistema de "gestos cívicos" — set unificado de acciones que el
// usuario puede realizar sobre el tablero. Filosofía Web 3.0:
// soberanía del usuario sobre sus datos, identidad opcional verificable
// (URL / NIF / nº de registro como validadores externos), composabilidad
// de acciones, anonimato por defecto en señal y reporte.
//
// Tipos de gesto:
//   - "senal"            → pulgar arriba/abajo, anónimo, 1 click
//   - "reporte"          → categoría preset por ámbito, anónimo, 3 clicks
//   - "compromiso"       → captura intención + identidad voluntaria
//   - "registro_entidad" → auto-alta como centro cívico / cooperativa /
//                          espacio cultural, con validadores externos
//
// El catálogo extendido (GESTO_CATALOG, más abajo) organiza estos tipos
// y otros en capas 0-6. La capa 6 ("ciclo cerrado") añade gestos que
// cierran un compromiso previo (`compromiso_cumplido`) o sintetizan
// fuentes diversas en un texto único (`sintesis`). Ver docs/GESTO-CATALOG.md.
//
// Política de moderación: cada gesto lleva un `userId` anónimo (UUID
// generado al primer uso del navegador, persistido en localStorage).
// El UID NO se publica en UI cara al público — solo aparece a admins en
// el backend para permitir amonestación si se demuestra falsedad
// (docs/CURATION-POLICY.md).
//
// Storage: cola en localStorage `polis-gestos` — array de objetos que el
// backend leerá y procesará cuando esté disponible.

const STORAGE_KEY        = "polis-gestos";
const UID_KEY            = "polis-uid";
const ADMIN_MODE_KEY     = "polis-admin-mode";
const AMONESTACIONES_KEY = "polis-amonestaciones";

// Passphrase temporal para activar modo admin en frontend puro.
// Documentada como PROVISIONAL en docs/ADMIN-PROTOCOL.md — sin backend
// real esta no es seguridad, solo evita que un usuario casual entre.
// Cuando llegue Supabase auth, isAdmin() se reescribe contra session role.
const ADMIN_SECRET = "polis-sapere-aude-2026";

// -----------------------------------------------------------
// Identidad anónima estable.

export function getUserId() {
  let uid = null;
  try { uid = localStorage.getItem(UID_KEY); } catch (e) { /* no-op */ }
  if (uid) return uid;
  uid = "u_" + Math.random().toString(36).slice(2, 10) +
         Date.now().toString(36).slice(-6);
  try { localStorage.setItem(UID_KEY, uid); } catch (e) { /* no-op */ }
  return uid;
}

// -----------------------------------------------------------
// Persistencia de gestos.

export function recordGesto(tipo, payload, zona) {
  const entry = {
    tipo,
    userId: getUserId(),
    payload: payload || {},
    zona: zona || null,
    ts: new Date().toISOString()
  };
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    prev.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
  } catch (e) {
    console.warn("[gestos] localStorage fallo:", e);
  }
  return entry;
}

export function getAllGestos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) { return []; }
}

// -----------------------------------------------------------
// CAPA ADMIN — Acceso al registro nominal de gestos.
//
// Solo accesible si isAdmin() === true. La UI pública NUNCA debe llamar
// estas funciones. Ver docs/ADMIN-PROTOCOL.md para el contrato completo.

export function isAdmin() {
  try {
    return localStorage.getItem(ADMIN_MODE_KEY) === "true";
  } catch (e) { return false; }
}

export function enableAdmin(passphrase) {
  if (passphrase !== ADMIN_SECRET) return false;
  try {
    localStorage.setItem(ADMIN_MODE_KEY, "true");
    return true;
  } catch (e) { return false; }
}

export function disableAdmin() {
  try { localStorage.removeItem(ADMIN_MODE_KEY); } catch (e) { /**/ }
}

// Registro nominal completo. NO filtra falsos (los admins necesitan
// verlos para auditoría). Filtros opcionales por ámbito/zona/tipo.
export function getRegistroDetallado(filtros = {}) {
  if (!isAdmin()) {
    console.warn("[gestos] getRegistroDetallado requiere modo admin");
    return [];
  }
  const all = getAllGestos();
  return all.filter(g => {
    if (filtros.ambito && g.payload?.ambito !== filtros.ambito) return false;
    if (filtros.zona && g.zona !== filtros.zona) return false;
    if (filtros.tipo && g.tipo !== filtros.tipo) return false;
    return true;
  });
}

// Marca un gesto como falso. NO lo borra (auditoría); las funciones de
// conteo público filtran los marcados.
export function marcarFalso(gestoTs, motivo) {
  if (!isAdmin()) return false;
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const idx = all.findIndex(g => g.ts === gestoTs);
    if (idx === -1) return false;
    all[idx].falso = true;
    all[idx].motivo_falso = motivo || "";
    all[idx].marcado_admin_ts = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) { return false; }
}

// Amonesta a un userId. Persiste en log separado.
export function amonestar(uid, motivo) {
  if (!isAdmin()) return false;
  try {
    const all = JSON.parse(localStorage.getItem(AMONESTACIONES_KEY) || "[]");
    all.push({
      uid, motivo: motivo || "",
      admin: "local",   // con backend será el auth.uid del admin
      ts: new Date().toISOString()
    });
    localStorage.setItem(AMONESTACIONES_KEY, JSON.stringify(all));
    return true;
  } catch (e) { return false; }
}

export function listarAmonestaciones(uidFiltro) {
  if (!isAdmin()) return [];
  try {
    const all = JSON.parse(localStorage.getItem(AMONESTACIONES_KEY) || "[]");
    return uidFiltro ? all.filter(a => a.uid === uidFiltro) : all;
  } catch (e) { return []; }
}

export function getGestosPorAmbito(ambitoId) {
  return getAllGestos().filter(g => g.payload?.ambito === ambitoId);
}

export function getGestosPorZona(zona) {
  if (!zona) return [];
  return getAllGestos().filter(g => g.zona === zona);
}

// -----------------------------------------------------------
// Conteos agregados por ámbito y zona (para mostrar en métricas).

export function getSenalesAggregadas(ambitoId, zona) {
  const all = getAllGestos();
  let pos = 0, neg = 0;
  for (const g of all) {
    if (g.tipo !== "senal") continue;
    if (g.falso) continue;  // los marcados como falsos no cuentan
    if (g.payload?.ambito !== ambitoId) continue;
    if (zona && g.zona !== zona) continue;
    if (g.payload?.valor === 1) pos++;
    else if (g.payload?.valor === -1) neg++;
  }
  return { pos, neg };
}

export function getReportesCount(ambitoId, zona) {
  return getAllGestos().filter(g =>
    g.tipo === "reporte" &&
    !g.falso &&
    g.payload?.ambito === ambitoId &&
    (!zona || g.zona === zona)
  ).length;
}

// -----------------------------------------------------------
// Taxonomía de reportes por ámbito.
//
// Cada ámbito define una lista corta de problemas tipificados. El
// usuario selecciona uno de un menú; no se pide texto libre (eso es
// "propuesta", que es otro gesto futuro).

export const REPORTES_POR_AMBITO = {
  espacio: [
    { id: "bache",       label: "Bache o desperfecto" },
    { id: "basura",      label: "Basura acumulada" },
    { id: "mobiliario",  label: "Mobiliario roto" },
    { id: "iluminacion", label: "Falta iluminación" },
    { id: "agua",        label: "Agua estancada" },
    { id: "grafiti",     label: "Grafiti / pintada agresiva" }
  ],
  movilidad: [
    { id: "marquesina",  label: "Parada sin marquesina" },
    { id: "retraso",     label: "Retraso recurrente" },
    { id: "paso",        label: "Falta paso peatonal" },
    { id: "carril_bici", label: "Carril bici en mal estado" },
    { id: "cobertura",   label: "Falta cobertura bus" }
  ],
  alimentacion: [
    { id: "precio",      label: "Precio inaccesible" },
    { id: "sin_mercado", label: "Falta mercadillo en zona" },
    { id: "cerrado",     label: "Productor / cooperativa cerrada" },
    { id: "lejos",       label: "Demasiado lejos para mi barrio" }
  ],
  cultura: [
    { id: "idioma",       label: "Barrera de idioma" },
    { id: "precio",       label: "Precio inaccesible" },
    { id: "accesibilidad",label: "No accesible (movilidad)" },
    { id: "cancelado",    label: "Evento cancelado / mal informado" },
    { id: "infrautil",    label: "Espacio infrautilizado" }
  ]
};

// -----------------------------------------------------------
// Categorías de entidad que un usuario puede auto-registrar.
//
// Espejo de tejido-social.geojson + productores-locales.geojson. Cada
// entrada lleva qué validador es típico para esa categoría (URL oficial,
// NIF, número de registro de asociaciones canario, etc.). El registro
// queda como "pendiente" hasta que la moderación lo valide.

export const CATEGORIAS_ENTIDAD = [
  { id: "cooperativa",        label: "Cooperativa",            validadores: ["url", "nif", "registro_cooperativas"] },
  { id: "asociacion_vecinos", label: "Asociación de vecinos",  validadores: ["url", "registro_asociaciones"] },
  { id: "asociacion_cultural",label: "Asociación cultural",    validadores: ["url", "registro_asociaciones"] },
  { id: "espacio_comunitario",label: "Espacio comunitario",    validadores: ["url"] },
  { id: "centro_social",      label: "Centro social",          validadores: ["url"] },
  { id: "huerto_urbano",      label: "Huerto urbano",          validadores: ["url"] },
  { id: "biblioteca_popular", label: "Biblioteca popular",     validadores: ["url"] },
  { id: "productor_queso",    label: "Productor de queso",     validadores: ["url", "nif", "do_quesos"] },
  { id: "productor_vino",     label: "Bodega",                 validadores: ["url", "nif"] },
  { id: "productor_cafe",     label: "Productor de café",      validadores: ["url", "nif"] },
  { id: "productor_miel",     label: "Apicultor",              validadores: ["url", "nif"] },
  { id: "productor_almendra", label: "Almendros / dulces",     validadores: ["url", "nif"] },
  { id: "productor_calado",   label: "Calado / textil",        validadores: ["url"] },
  { id: "productor_otro",     label: "Otro pequeño productor", validadores: ["url", "nif"] },
  { id: "mercadillo",         label: "Mercadillo / mercado",   validadores: ["url"] }
];

export const VALIDADOR_LABELS = {
  url: "Página web oficial",
  nif: "NIF de la entidad",
  registro_asociaciones: "Nº de Registro de Asociaciones (Gobierno de Canarias)",
  registro_cooperativas: "Nº de Registro de Cooperativas",
  do_quesos: "Denominación de Origen (si aplica)"
};

// =============================================================
// CATÁLOGO EXPANDIDO DE GESTOS — Tabla declarativa gesto × sujeto.
//
// Diseño y decisiones en docs/GESTO-CATALOG.md.
//
// Compatibilidad: este bloque AMPLÍA el módulo. Los gestos clásicos
// (senal/reporte/compromiso/registro_entidad) siguen registrándose con
// recordGesto() como antes. El catálogo es la fuente de verdad para
// "qué gestos puede hacer el usuario sobre este sujeto", no reemplaza
// la API de persistencia.

// 9 sujetos. agregacion_publica controla cómo se publican métricas:
// "punto" = cada sujeto con sus contadores; "barrio"/"municipio" =
// anti-dox/anti-linchamiento (la unidad individual nunca se expone).
export const SUJETO_TYPES = {
  comercio:          { label: "Comercio / productor",       agregacion_publica: "punto" },
  entidad_civica:    { label: "Entidad cívica",             agregacion_publica: "punto" },
  espacio_publico:   { label: "Espacio público",            agregacion_publica: "punto" },
  equipamiento:      { label: "Equipamiento público",       agregacion_publica: "municipio" },
  evento:            { label: "Evento",                     agregacion_publica: "punto" },
  patrimonio:        { label: "Patrimonio",                 agregacion_publica: "punto" },
  vivienda:          { label: "Vivienda residencial",       agregacion_publica: "barrio" },
  infra_movilidad:   { label: "Infraestructura movilidad",  agregacion_publica: "punto" },
  edificio_generico: { label: "Edificio sin tipo",          agregacion_publica: "punto" }
};

const TAGS_RECOMIENDO = ["con_crios","tarde","barato","lluvia","solo","grupo","pareja","trabajo"];
const TAGS_ACCESIBILIDAD = ["rampa","bano","parking","mascotas","wifi","sombra","iluminacion_nocturna"];
const TAGS_PRECIO = ["accesible","medio","caro"];

// Política de publicación para gestos con texto/imagen libre.
// Decisión 2026-05-13 (PENDIENTE 1+4): hoy todo localStorage visible
// sólo al autor; al llegar Supabase, anónimo → cola, pseudónimo → directa.
const PUB_TEXTO_LIBRE = {
  pre_supabase: "solo_autor_local",
  si_anonimo: "cola_moderacion",
  si_pseudonimo: "directa"
};

export const GESTO_CATALOG = {
  // ── Capa 0 · Pasiva ───────────────────────────────────────
  visita: {
    capa: 0, coste: "auto", identidad: "anonimo", ui: "implicito",
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","evento","patrimonio","infra_movilidad"],
    condiciones: []
  },

  // ── Capa 1 · Atómica ──────────────────────────────────────
  senal_pos: {
    capa: 1, coste: "1-click", identidad: "anonimo", ui: "icon-button",
    payload_schema: { valor: { type: "literal", value: 1 } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","evento","patrimonio","infra_movilidad"],
    condiciones: []
  },
  senal_neg: {
    capa: 1, coste: "1-click", identidad: "anonimo", ui: "icon-button",
    payload_schema: { valor: { type: "literal", value: -1 } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","evento","patrimonio","infra_movilidad"],
    condiciones: []
  },
  sigue_vivo: {
    capa: 1, coste: "1-click", identidad: "anonimo", ui: "icon-button",
    aplica_a: ["comercio","entidad_civica"],
    condiciones: []
  },
  guardar: {
    capa: 1, coste: "1-click", identidad: "anonimo", ui: "icon-button",
    aplica_a: ["comercio","entidad_civica","espacio_publico","evento","patrimonio"],
    condiciones: [{ tipo: "almacenamiento", destino: "perfil_usuario" }]
  },
  arraigo_aqui: {
    capa: 1, coste: "1-click", identidad: "anonimo", ui: "icon-button",
    aplica_a: ["vivienda"],
    condiciones: [
      { tipo: "agregacion_obligatoria", nivel: "barrio" },
      { tipo: "descartar_zona_puntual" }
    ]
  },

  // ── Capa 2 · Marcador ─────────────────────────────────────
  check_in: {
    capa: 2, coste: "2-click", identidad: "anonimo", ui: "icon-button",
    aplica_a: ["comercio","entidad_civica","espacio_publico","evento"],
    condiciones: []
  },
  recomiendo_para: {
    capa: 2, coste: "2-click", identidad: "anonimo", ui: "tag-picker",
    payload_schema: { tag: { type: "enum", values: TAGS_RECOMIENDO } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","evento"],
    condiciones: []
  },
  reporte: {
    capa: 2, coste: "3-click", identidad: "anonimo", ui: "category-picker",
    payload_schema: {
      ambito: { type: "enum", values: ["espacio","movilidad","alimentacion","cultura"] },
      categoria: { type: "ref", source: "REPORTES_POR_AMBITO" }
    },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","evento","patrimonio","infra_movilidad","edificio_generico"],
    condiciones: []
  },
  rango_precio: {
    capa: 2, coste: "2-click", identidad: "anonimo", ui: "tag-picker",
    payload_schema: { rango: { type: "enum", values: TAGS_PRECIO } },
    aplica_a: ["comercio","evento"],
    condiciones: [
      { tipo: "requiere_flag_sujeto_si",
        si_tipo: "evento",
        campo: "tiene_precio", valor: true }
    ]
  },
  accesibilidad: {
    capa: 2, coste: "multi", identidad: "anonimo", ui: "checkbox-multi",
    payload_schema: { tags: { type: "multi-enum", values: TAGS_ACCESIBILIDAD } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","evento","patrimonio","infra_movilidad"],
    condiciones: []
  },

  // ── Capa 3 · Aportación (sólo autor hasta Supabase) ───────
  foto: {
    capa: 3, coste: "form", identidad: "anonimo", ui: "file-input",
    payload_schema: { imagen: { type: "blob", mime: "image/*" } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","evento","patrimonio"],
    condiciones: [{ tipo: "publicacion", politica: PUB_TEXTO_LIBRE }]
  },
  anecdota: {
    capa: 3, coste: "form", identidad: "anonimo", ui: "text-input",
    payload_schema: { texto: { type: "text", max_length: 280 } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","patrimonio","edificio_generico"],
    condiciones: [{ tipo: "publicacion", politica: PUB_TEXTO_LIBRE }]
  },
  memoria_historica: {
    capa: 3, coste: "form", identidad: "anonimo", ui: "text-input",
    payload_schema: {
      texto: { type: "text", max_length: 280 },
      ano_aprox: { type: "number", optional: true }
    },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","patrimonio","edificio_generico"],
    condiciones: [{ tipo: "publicacion", politica: PUB_TEXTO_LIBRE }]
  },
  propuesta: {
    capa: 3, coste: "form", identidad: "anonimo", ui: "text-input",
    payload_schema: { texto: { type: "text", max_length: 280 } },
    aplica_a: ["comercio","entidad_civica","espacio_publico","equipamiento","patrimonio","infra_movilidad","edificio_generico"],
    condiciones: [{ tipo: "publicacion", politica: PUB_TEXTO_LIBRE }]
  },
  alta_ciudadana: {
    capa: 3, coste: "form", identidad: "anonimo", ui: "form-validador",
    payload_schema: {
      categoria: { type: "ref", source: "CATEGORIAS_ENTIDAD" },
      nombre: { type: "text", max_length: 120 },
      validador_tipo: { type: "enum", values: ["url","nif","registro_asociaciones","registro_cooperativas","do_quesos"] },
      validador_valor: { type: "text", max_length: 200 }
    },
    aplica_a: ["comercio","entidad_civica","evento"],
    condiciones: [
      { tipo: "requiere_flag_sujeto_negado", campo: "existe_en_mapa", valor: true },
      { tipo: "publicacion", politica: { siempre: "cola_moderacion", pre_supabase: "solo_autor_local" } }
    ]
  },
  baja: {
    capa: 3, coste: "form", identidad: "anonimo", ui: "form-confirm",
    payload_schema: { motivo: { type: "text", max_length: 200, optional: true } },
    aplica_a: ["comercio","entidad_civica"],
    condiciones: [{ tipo: "publicacion", politica: { siempre: "cola_moderacion", pre_supabase: "solo_autor_local" } }]
  },

  // ── Capa 4 · Compromiso ───────────────────────────────────
  cliente_habitual: {
    capa: 4, coste: "form", identidad: "pseudonimo_estable", ui: "form-confirm",
    aplica_a: ["comercio"],
    condiciones: [
      { tipo: "requiere_identidad", nivel: "pseudonimo_estable" },
      { tipo: "oculto_si_flag", campo: "franquicia", valor: true }
    ]
  },
  me_ofrezco: {
    capa: 4, coste: "form", identidad: "pseudonimo_estable", ui: "form-input",
    payload_schema: {
      modo: { type: "enum", values: ["voluntariado","mentoria","intercambio"] },
      texto: { type: "text", max_length: 280, optional: true }
    },
    aplica_a: ["entidad_civica","espacio_publico","evento"],
    condiciones: [{ tipo: "requiere_identidad", nivel: "pseudonimo_estable" }]
  },
  contribuyo: {
    capa: 4, coste: "form", identidad: "pseudonimo_estable", ui: "form-confirm",
    aplica_a: ["entidad_civica","evento"],
    condiciones: [{ tipo: "requiere_identidad", nivel: "pseudonimo_estable" }]
  },
  convoco_aqui: {
    capa: 4, coste: "form", identidad: "pseudonimo_estable", ui: "form-evento",
    payload_schema: {
      titulo: { type: "text", max_length: 120 },
      fecha: { type: "date" },
      descripcion: { type: "text", max_length: 280, optional: true }
    },
    aplica_a: ["entidad_civica","espacio_publico"],
    condiciones: [
      { tipo: "requiere_identidad", nivel: "pseudonimo_estable" },
      { tipo: "publicacion", politica: { siempre: "cola_moderacion", pre_supabase: "solo_autor_local" } }
    ]
  },

  // convoco_quorum / firmo_quorum: convocatorias con umbral. La
  // convocatoria sólo se "abre" si recibe N firmas antes de una fecha
  // límite. Esto es el corazón de la mecánica de masa crítica:
  // termómetro visible, autoorganización por umbral, fracaso elegante
  // si no llega (queda como propuesta archivada). Diseñado para vivir
  // localStorage primero; al llegar Supabase, las firmas se federan.
  convoco_quorum: {
    capa: 4, coste: "form", identidad: "pseudonimo_estable", ui: "form-quorum",
    payload_schema: {
      titulo: { type: "text", max_length: 120 },
      descripcion: { type: "text", max_length: 280, optional: true },
      umbral: { type: "number" },                  // firmas necesarias
      deadline: { type: "date" },                   // fecha límite ISO
      lugar: { type: "text", max_length: 120, optional: true },
      fecha_evento: { type: "date", optional: true } // cuándo pasaría si se alcanza
    },
    aplica_a: ["entidad_civica","espacio_publico","edificio_generico"],
    condiciones: [
      { tipo: "requiere_identidad", nivel: "pseudonimo_estable" },
      { tipo: "publicacion", politica: { siempre: "cola_moderacion", pre_supabase: "solo_autor_local" } }
    ]
  },
  firmo_quorum: {
    capa: 4, coste: "1-click", identidad: "pseudonimo_estable", ui: "icon-button",
    payload_schema: {
      quorum_ref: { type: "text", max_length: 80 }  // ts/id del gesto convoco_quorum
    },
    aplica_a: ["entidad_civica","espacio_publico","edificio_generico"],
    condiciones: [
      { tipo: "requiere_identidad", nivel: "pseudonimo_estable" },
      // Una firma por userId por quórum: la lógica de unicidad la aplica
      // el cliente al persistir (consulta el log antes de insertar) y
      // el backend al federar.
      { tipo: "unicidad_por_usuario_y_referencia", referencia: "quorum_ref" }
    ]
  },

  // ── Capa 5 · Vinculación oficial ──────────────────────────
  soy_de_entidad: {
    capa: 5, coste: "form", identidad: "pseudonimo_verificado", ui: "form-validador",
    payload_schema: {
      categoria: { type: "ref", source: "CATEGORIAS_ENTIDAD" },
      validador_tipo: { type: "enum", values: ["url","nif","registro_asociaciones","registro_cooperativas","do_quesos"] },
      validador_valor: { type: "text", max_length: 200 }
    },
    aplica_a: ["comercio","entidad_civica"],
    condiciones: [
      { tipo: "requiere_validador",
        validadores: ["url","nif","registro_asociaciones","registro_cooperativas"] },
      { tipo: "publicacion", politica: { siempre: "cola_moderacion", pre_supabase: "solo_autor_local" } },
      { tipo: "oculto_si_flag", campo: "franquicia", valor: true }
    ]
  },
  alianza: {
    capa: 5, coste: "form", identidad: "pseudonimo_verificado", ui: "form-input",
    payload_schema: { entidad_destino_id: { type: "text", max_length: 80 } },
    aplica_a: ["comercio","entidad_civica"],
    condiciones: [
      { tipo: "requiere_rol", rol: "representante_entidad" },
      { tipo: "publicacion", politica: { siempre: "cola_moderacion", pre_supabase: "solo_autor_local" } }
    ]
  },
  publico_balance: {
    capa: 5, coste: "form", identidad: "pseudonimo_verificado", ui: "form-input",
    payload_schema: { url_balance: { type: "text", max_length: 500 } },
    aplica_a: ["comercio","entidad_civica"],
    condiciones: [
      { tipo: "requiere_rol", rol: "representante_entidad" }
    ]
  },
  respaldo: {
    capa: 5, coste: "form", identidad: "pseudonimo_verificado", ui: "form-input",
    payload_schema: {
      sujeto_destino: { type: "text", max_length: 80 },
      texto: { type: "text", max_length: 280, optional: true }
    },
    aplica_a: ["comercio","entidad_civica","evento"],
    condiciones: [
      { tipo: "requiere_rol", rol: "representante_entidad" }
    ]
  },

  // ── Capa 6 · Ciclo cerrado ────────────────────────────────
  // Gestos que CIERRAN un ciclo abierto por otro gesto previo, o que
  // SINTETIZAN material disperso en una pieza nueva. No son acciones
  // sobre el sujeto, son acciones sobre la trayectoria del sujeto en el
  // tiempo. Por eso muchas tienen `requiere_gesto_previo` o exigen
  // diversidad de fuentes.
  //
  // compromiso_cumplido: marca como cerrado un compromiso/convocatoria/
  // oferta/contribución previa. `aplica_a` deriva de unir los sujetos
  // donde aplica el gesto "compromiso" clásico (tipo de cabecera, no en
  // GESTO_CATALOG todavía — TODO: añadir entrada formal) más los de los
  // gestos de capa 4: convoco_aqui (entidad_civica, espacio_publico),
  // me_ofrezco (entidad_civica, espacio_publico, evento), contribuyo
  // (entidad_civica, evento). Unión final: entidad_civica, espacio_publico,
  // evento. Decisión: el cierre se documenta con `compromiso_ref` (ts del
  // gesto original) para permitir auditar pares apertura→cierre.
  compromiso_cumplido: {
    capa: 6, coste: "1-click", identidad: "anonimo", ui: "icon-button",
    payload_schema: {
      compromiso_ref: { type: "text", max_length: 80 },  // ts del gesto compromiso original
      nota: { type: "text", max_length: 280, optional: true }
    },
    aplica_a: ["entidad_civica","espacio_publico","evento"],
    condiciones: [
      // El cierre vale para cualquier compromiso abierto por el mismo
      // userId: el clásico "compromiso" o cualquier gesto de capa 4
      // (convoco_aqui, me_ofrezco, contribuyo). Listamos "compromiso"
      // como ancla principal; la lógica de verificación cruzada contra
      // los otros se hace en backend al persistir (no en UI).
      { tipo: "requiere_gesto_previo", gesto: "compromiso" }
    ]
  },

  // sintesis: texto largo que destila varias fuentes (canónicas, críticas,
  // externas) en una pieza única. Es el gesto de la Biblioteca: no se
  // ata a un sujeto físico concreto, va sobre "edificio_generico" como
  // contenedor abstracto. Exige diversidad mínima: 1 canónica + 1 crítica
  // para evitar síntesis sesgadas a una sola perspectiva.
  sintesis: {
    capa: 6, coste: "form", identidad: "anonimo", ui: "form-sintesis",
    payload_schema: {
      titulo: { type: "text", max_length: 120 },
      texto: { type: "text", max_length: 1000 },
      fuentes: {
        type: "multi-ref",
        min_items: 2,
        schema: {
          id: { type: "text", max_length: 120 },
          origen: { type: "enum", values: ["canonico","critico","externo"] },
          cita_breve: { type: "text", max_length: 200, optional: true }
        }
      }
    },
    aplica_a: ["edificio_generico"],  // Biblioteca es etérea — no se ata a un sujeto físico
    condiciones: [
      { tipo: "min_fuentes_diversas", min_canonicas: 1, min_criticas: 1 },
      { tipo: "publicacion", politica: PUB_TEXTO_LIBRE }
    ]
  }
};

// Índice derivado: por sujeto → IDs de gestos aplicables. Calculado
// una sola vez al cargar el módulo.
export const GESTOS_POR_SUJETO = Object.keys(SUJETO_TYPES).reduce((acc, tipo) => {
  acc[tipo] = Object.entries(GESTO_CATALOG)
    .filter(([, g]) => g.aplica_a.includes(tipo))
    .map(([id]) => id);
  return acc;
}, {});

// Evaluador de condiciones.
//
// sujeto   = { tipo, id, flags: {franquicia?, tiene_precio?, es_vv?, existe_en_mapa?, ...} }
// contexto = { actor: {identidad, rol}, zona, datos? }
//
// Las condiciones de publicación/moderación/agregación NO bloquean la
// disponibilidad en la UI — se aplican en el momento de persistir o
// publicar. Sólo bloquean las de identidad/rol/flags del sujeto.
function evaluarUnaCondicion(c, sujeto, contexto) {
  switch (c.tipo) {
    case "requiere_identidad": {
      const nivel = contexto?.actor?.identidad || "anonimo";
      const ORDEN = ["anonimo","pseudonimo_estable","pseudonimo_verificado"];
      return ORDEN.indexOf(nivel) >= ORDEN.indexOf(c.nivel);
    }
    case "requiere_rol":
      return contexto?.actor?.rol === c.rol;
    case "requiere_flag_sujeto":
      return sujeto?.flags?.[c.campo] === c.valor;
    case "requiere_flag_sujeto_negado":
      return sujeto?.flags?.[c.campo] !== c.valor;
    case "requiere_flag_sujeto_si":
      if (sujeto?.tipo !== c.si_tipo) return true;
      return sujeto?.flags?.[c.campo] === c.valor;
    case "requiere_validador":
    case "publicacion":
    case "oculto_si_flag":
    case "moderacion":
    case "almacenamiento":
    case "agregacion_obligatoria":
    case "descartar_zona_puntual":
      return true;
    // Capa 6 — condiciones de cierre/síntesis. NO bloquean disponibilidad
    // UI: el botón se muestra siempre que el sujeto encaje; la validación
    // real ocurre al persistir (igual que con "publicacion"). El backend
    // (o el wrapper de recordGesto futuro) comprobará que existe un
    // gesto previo abierto del mismo userId, y que el array `fuentes`
    // contiene al menos 1 canónica y 1 crítica.
    case "requiere_gesto_previo":
    case "min_fuentes_diversas":
    case "unicidad_por_usuario_y_referencia":
      // unicidad_por_usuario_y_referencia: el cliente debe filtrar el log
      // antes de insertar (no se puede firmar dos veces el mismo quórum).
      // No bloquea UI: el botón se muestra; la verificación ocurre en
      // recordGesto wrapper o backend.
      return true;
    default:
      console.warn("[gestos] condición desconocida:", c.tipo);
      return true;
  }
}

export function evaluarCondiciones(gesto, sujeto, contexto) {
  for (const c of (gesto.condiciones || [])) {
    if (!evaluarUnaCondicion(c, sujeto, contexto)) return false;
  }
  return true;
}

// API pública consumida por el popup unificado (futuro).
//
// Devuelve la lista de gestos disponibles para un sujeto dado, ya
// filtrada por identidad/rol/flags del contexto. Cada item incluye su
// definición completa para que la UI pueda renderizar el botón con el
// ui-type correcto.
export function gestosDisponiblesPara(sujeto, contexto) {
  if (!sujeto || !sujeto.tipo) return [];
  const ids = GESTOS_POR_SUJETO[sujeto.tipo] || [];
  return ids
    .map(id => ({ id, ...GESTO_CATALOG[id] }))
    .filter(g => evaluarCondiciones(g, sujeto, contexto || {}));
}

// Política de publicación efectiva para un gesto dado, según contexto.
// Útil para decidir si el gesto va a localStorage privado, cola de
// moderación o publicación directa. Devuelve el string de política.
export function politicaPublicacion(gesto, contexto) {
  const cond = (gesto.condiciones || []).find(c => c.tipo === "publicacion");
  if (!cond) return "directa";
  const pol = cond.politica || {};
  // Pre-Supabase: todo a localStorage del autor (decisión 2026-05-13).
  if (!contexto?.supabase_disponible) {
    return pol.pre_supabase || "solo_autor_local";
  }
  if (pol.siempre) return pol.siempre;
  const nivel = contexto?.actor?.identidad || "anonimo";
  if (nivel === "anonimo") return pol.si_anonimo || "cola_moderacion";
  return pol.si_pseudonimo || "directa";
}

// Gestos de capa 6 — los que cierran ciclos abiertos por otros gestos
// (compromiso_cumplido) o destilan material previo (sintesis). Útil para
// que la UI los agrupe aparte ("acciones de cierre") y para que el
// evaluador de logros futuro los trate como hitos, no como aportaciones
// nuevas.
export const GESTOS_DE_CIERRE = ["compromiso_cumplido", "sintesis"];

// Nivel de agregación para publicación de métricas. Combina la regla
// del sujeto (anti-dox/anti-linchamiento) con la regla del gesto (p.ej.
// arraigo_aqui fuerza barrio aunque cambiase el sujeto).
export function nivelAgregacion(gesto, sujeto) {
  const condGesto = (gesto.condiciones || []).find(c => c.tipo === "agregacion_obligatoria");
  if (condGesto) return condGesto.nivel;
  return SUJETO_TYPES[sujeto?.tipo]?.agregacion_publica || "punto";
}
