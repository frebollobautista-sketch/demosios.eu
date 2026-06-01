// agora-app/sillas.js — Feature "Sillas Vacías".
//
// El tejido social canario tiene ~3926 entidades reales (asociaciones de
// vecinos, cooperativas, colectivos, huertos urbanos, bibliotecas
// populares...) que existen OFFLINE pero que nadie vinculado ha
// "reclamado" todavía dentro de POLIS. Cada entidad sin reclamación es
// una SILLA VACÍA — una invitación visible a que alguien con cuerda
// dentro de esa entidad se siente y diga "yo respondo por esto".
//
// La metáfora importa: no son "datos faltantes" ni "registros pendientes";
// son sillas vacías en una asamblea que ya ha empezado. El feed las
// muestra mezcladas con el resto de posts para que la convocatoria sea
// orgánica, no una pestaña administrativa.
//
// Contrato Post: heredado tal cual de feed.js (NO añadir campos a la
// ligera). El kind="silla_vacia" es la única señal nueva que app.js
// necesita para decidir qué renderer usar.
//
// Una silla deja de estar vacía cuando aparece en el log local un gesto
// de tipo soy_de_entidad / alta_ciudadana / sigue_vivo / reclamar_entidad
// con payload.entidad_id (o payload.nombre como fallback) apuntando al
// feature. La política está concentrada en detectarReclamadas() para que
// la UI pueda reutilizarla en otros contextos (ej: highlight en mapas).

import { getAllGestos } from "../shared/gestos.js?v=20260529-agora-verde";

// =============================================================
// CONFIGURACIÓN POR DEFECTO
//
// max_items capa el número de sillas inyectadas al feed; 3926 sillas a
// pelo ahogarían cualquier ranking. 30 es suficiente para que siempre
// haya alguna visible sin desplazar al resto de fuentes.

export const SILLAS_DEFAULT_CONFIG = {
  enabled: true,
  max_items: 30,
  prioridad: "aleatorio"   // "aleatorio" | "alfabetico" | "categoria"
};

// Tipos de gesto que cuentan como "reclamación" de una entidad. Si un
// usuario ha hecho cualquiera de éstos sobre la entidad, deja de ser una
// silla vacía. "reclamar_entidad" se reserva como futuro gesto explícito
// (hoy no existe en el catálogo, pero lo aceptamos por compatibilidad).
const TIPOS_RECLAMACION = new Set([
  "soy_de_entidad",
  "alta_ciudadana",
  "sigue_vivo",
  "reclamar_entidad"
]);

// URL del GeoJSON canónico. Misma ruta que usa feed.js para "tejido".
const TEJIDO_URL = "../data/tejido-social-canarias-v2.geojson";

// =============================================================
// detectarReclamadas(gestos) — set de IDs ya reclamados.
//
// Una entidad se considera reclamada si CUALQUIER gesto del log tiene:
//   - tipo ∈ TIPOS_RECLAMACION
//   - !falso (los marcados como falsos no cuentan)
//   - payload.entidad_id === feature.id  (preferido)
//     o, en su defecto, payload.nombre === feature.nombre
//
// Devolvemos un Set con TODOS los identificadores posibles (id + nombre
// normalizado) para que el caller pueda mirar por cualquiera de los dos
// sin tener que saber cuál guardó el gesto.

function _normNombre(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

export function detectarReclamadas(gestos) {
  const set = new Set();
  if (!Array.isArray(gestos)) return set;
  for (const g of gestos) {
    if (!g || g.falso) continue;
    if (!TIPOS_RECLAMACION.has(g.tipo)) continue;
    const p = g.payload || {};
    if (p.entidad_id) set.add(String(p.entidad_id));
    if (p.nombre)     set.add("nombre:" + _normNombre(p.nombre));
  }
  return set;
}

// =============================================================
// Helper interno — saca un "entidad_id" estable del feature.
//
// El GeoJSON ya trae `properties.id` (ej "as-canarias-3473") en la
// inmensa mayoría de entidades. Si por lo que sea no lo trae, caemos a
// un hash del nombre normalizado — feo pero estable mientras no cambien
// los datos.

function _entidadIdDeFeature(feature) {
  const p = feature.properties || {};
  if (p.id) return String(p.id);
  if (p.nombre) return "nombre:" + _normNombre(p.nombre);
  return null;
}

// safeId — versión URL/DOM-safe para usar como id de Post.
function _safeId(raw) {
  return String(raw || "anon")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// Etiqueta legible para la categoría (fallback al raw si no la
// conocemos). Espejo informal de CATEGORIAS_ENTIDAD en gestos.js, pero
// no la importamos para no acoplar: si añaden categorías nuevas allí,
// aquí cae a "Entidad cívica" y listo, sin romper.
const CATEGORIA_LABELS = {
  asociacion_cultural:  "Asociación cultural",
  asociacion_vecinos:   "Asociación de vecinos",
  cooperativa:          "Cooperativa",
  espacio_comunitario:  "Espacio comunitario",
  centro_social:        "Centro social",
  huerto_urbano:        "Huerto urbano",
  biblioteca_popular:   "Biblioteca popular"
};

function _labelCategoria(cat) {
  if (!cat) return "Entidad cívica";
  return CATEGORIA_LABELS[cat] || cat;
}

// =============================================================
// _featureToSilla(feature) — normaliza un Feature a Post silla_vacia.
//
// Sigue el contrato Post locked en feed.js. Las dims son ESTÁTICAS
// porque las sillas no tienen ts, ni autor, ni reaccion mecánica:
//   cercania:     0   (sin geo del usuario, neutro)
//   conocidos:   -1   (por definición desconocidos — nadie las ha tocado)
//   reaccionar:  +1   (ES literalmente una llamada a acción)
//   temporalidad: 0   (sin tiempo asociado)

function _featureToSilla(feature) {
  const p = feature.properties || {};
  const nombre = p.nombre || "Entidad sin nombre";
  const idRaw = _entidadIdDeFeature(feature) || "anon-" + Math.random().toString(36).slice(2, 8);
  const categoriaLabel = _labelCategoria(p.categoria);

  // Coordenadas Point [lng, lat]; respetamos el formato GeoJSON tal cual.
  const coords = feature.geometry?.type === "Point"
    ? feature.geometry.coordinates
    : null;

  const zona = p.municipio || p.isla || "Canarias";
  const geo = { zona };
  if (p.municipio) geo.municipio = p.municipio;
  if (p.isla)      geo.isla      = p.isla;
  if (coords && coords.length >= 2) geo.coords = [coords[0], coords[1]];

  const extras = [categoriaLabel, p.municipio, p.isla].filter(Boolean).join(" · ");
  const body =
    nombre +
    (extras ? "\n" + extras : "") +
    "\n\nEsta entidad existe pero nadie vinculado ha firmado en POLIS.";

  return {
    id: "silla-" + _safeId(idRaw),
    source: "civic",
    source_label: "SILLA VACÍA",
    kind: "silla_vacia",
    author: null,
    body,
    ts: null,
    geo,
    payload: p,                  // crudo, para alimentar el form al reclamar
    url_origen: p.web || null,   // muchas entidades traen web=null; respetamos
    dims: {
      cercania: 0,
      conocidos: -1,
      reaccionar: +1,
      temporalidad: 0
    }
  };
}

// =============================================================
// _priorizar(features, prioridad) — ordena en sitio.
//
// "aleatorio" usa Fisher-Yates para una mezcla uniforme; así cada recarga
// muestra sillas distintas y la "rotación" feel natural.
// "alfabetico" y "categoria" son ordenaciones estables por properties.

function _priorizar(features, prioridad) {
  if (prioridad === "alfabetico") {
    features.sort((a, b) => {
      const na = (a.properties?.nombre || "").toLocaleLowerCase("es");
      const nb = (b.properties?.nombre || "").toLocaleLowerCase("es");
      return na.localeCompare(nb, "es");
    });
  } else if (prioridad === "categoria") {
    features.sort((a, b) => {
      const ca = a.properties?.categoria || "";
      const cb = b.properties?.categoria || "";
      if (ca !== cb) return ca.localeCompare(cb);
      const na = (a.properties?.nombre || "").toLocaleLowerCase("es");
      const nb = (b.properties?.nombre || "").toLocaleLowerCase("es");
      return na.localeCompare(nb, "es");
    });
  } else {
    // Fisher-Yates in-place.
    for (let i = features.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [features[i], features[j]] = [features[j], features[i]];
    }
  }
  return features;
}

// =============================================================
// loadSillasVacias(config) → Promise<Post[]>
//
// Fetch del GeoJSON tejido-social-canarias-v2 → filtro de reclamadas
// usando el log local → priorización → mapeo a Post[]. Tolerante a
// fallos: si el fetch revienta, devuelve [] y avisa por consola.

export async function loadSillasVacias(config = SILLAS_DEFAULT_CONFIG) {
  const cfg = { ...SILLAS_DEFAULT_CONFIG, ...(config || {}) };
  if (!cfg.enabled) return [];

  let json;
  try {
    const res = await fetch(TEJIDO_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    json = await res.json();
  } catch (e) {
    console.warn("[sillas] fallo cargando tejido:", e?.message || e);
    return [];
  }

  const features = (json.features || []).filter(f => f.geometry?.type === "Point");

  // Filtrado por reclamación. detectarReclamadas devuelve tanto IDs como
  // "nombre:<normalizado>"; comprobamos las dos posibilidades.
  const reclamadas = detectarReclamadas(getAllGestos());
  const libres = features.filter(f => {
    const id = _entidadIdDeFeature(f);
    if (id && reclamadas.has(id)) return false;
    const nombreKey = "nombre:" + _normNombre(f.properties?.nombre || "");
    if (reclamadas.has(nombreKey)) return false;
    return true;
  });

  const ordenadas = _priorizar(libres, cfg.prioridad);
  const recortadas = ordenadas.slice(0, cfg.max_items);

  return recortadas.map(_featureToSilla);
}

// =============================================================
// renderSillaCard(post, ctx) → HTMLElement
//
// Render específico de cards kind="silla_vacia". La estructura DOM imita
// a la del feed normal para que CSS comparta variables, pero:
//   - añade clase .is-silla al article para acento visual (ver sillas.css)
//   - omite avatar/autor (las sillas no tienen autor — por definición)
//   - cambia las acciones: en lugar de senal/guardar/nota/mision usa
//     dos botones text-only: [reclamar] y [✓ sigue viva]
//
// El HUD lo monta app.js fuera de aquí (igual que con cualquier otra
// card) — devolvemos un <div class="post-hud"> vacío en el sitio
// correcto para que mountHud lo encuentre.
//
// IMPORTANTE: este render NO emite gestos. Cablea los botones a los
// callbacks de ctx, que app.js inyecta. Esto mantiene la separación
// "el módulo de sillas sabe de su shape, la app sabe del flujo".

export function renderSillaCard(post, ctx) {
  const article = document.createElement("article");
  article.className = "post is-silla";
  article.dataset.source = post.source || "civic";
  article.dataset.kind = "silla_vacia";
  article.dataset.postId = post.id;

  // ── Head: geo + source ─────────────────────────────
  const head = document.createElement("header");
  head.className = "post-head";

  const geo = document.createElement("span");
  geo.className = "post-geo";
  if (post.geo && post.geo.zona) {
    geo.textContent = "◉ " + post.geo.zona;
  } else {
    geo.classList.add("is-empty");
    geo.textContent = "◉ sin geo";
  }

  const src = document.createElement("span");
  src.className = "post-source is-silla-label";
  src.textContent = post.source_label || "SILLA VACÍA";

  head.append(geo, src);

  // ── Body ───────────────────────────────────────────
  // No metemos post-author: las sillas no tienen handle. El nombre de la
  // entidad va dentro del body (primera línea).
  const body = document.createElement("div");
  body.className = "post-body is-silla-body";
  body.textContent = post.body || "";

  // ── HUD ────────────────────────────────────────────
  // Contenedor vacío; app.js (mountHud) lo rellenará con su HUD estándar
  // de dimensiones, igual que cualquier otra card.
  const hud = document.createElement("div");
  hud.className = "post-hud";

  // ── Acciones — DOS botones text-only ───────────────
  // Diferencia intencionada vs cards normales: usamos texto en lugar de
  // iconos para subrayar que son acciones de otra naturaleza
  // (compromiso / verificación), no reacciones rápidas.
  const footer = document.createElement("footer");
  footer.className = "post-actions is-silla-actions";

  const btnReclamar = document.createElement("button");
  btnReclamar.type = "button";
  btnReclamar.className = "act act-silla-reclamar";
  btnReclamar.dataset.act = "reclamar";
  btnReclamar.textContent = "reclamar";
  btnReclamar.title = "Soy parte de esta entidad y respondo por ella";
  btnReclamar.addEventListener("click", () => {
    if (ctx && typeof ctx.onReclamar === "function") {
      ctx.onReclamar(post);
    } else {
      console.warn("[sillas] onReclamar no inyectado en ctx");
    }
  });

  const btnSigueViva = document.createElement("button");
  btnSigueViva.type = "button";
  btnSigueViva.className = "act act-silla-sigueviva";
  btnSigueViva.dataset.act = "sigue_vivo";
  btnSigueViva.textContent = "✓ sigue viva";
  btnSigueViva.title = "Confirmo que esta entidad sigue activa";
  btnSigueViva.addEventListener("click", () => {
    if (ctx && typeof ctx.onSigueVivo === "function") {
      ctx.onSigueVivo(post);
    } else {
      console.warn("[sillas] onSigueVivo no inyectado en ctx");
    }
  });

  footer.append(btnReclamar, btnSigueViva);

  // Si la entidad trajo web, ofrecemos enlace de origen igual que en
  // posts normales (esquina derecha del footer).
  if (post.url_origen) {
    const link = document.createElement("a");
    link.className = "post-link";
    link.href = post.url_origen;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "↗";
    link.title = "Abrir web de la entidad";
    footer.appendChild(link);
  }

  article.append(head, body, hud, footer);
  return article;
}

// =============================================================
// MINI-TEST DOCUMENTAL (no se ejecuta)
//
// Pega un sample del GeoJSON y enseña qué Post resulta + qué hace
// detectarReclamadas. Útil para validar el mapeo sin correr la app.
//
// ── Entrada GeoJSON sample ───────────────────────────────────
//   {
//     "type": "Feature",
//     "geometry": { "type": "Point", "coordinates": [-15.433964, 28.136947] },
//     "properties": {
//       "id": "as-canarias-3473",
//       "nombre": "ALCOHOLICOS ANONIMOS - GRUPO LAS PALMAS",
//       "categoria": "asociacion_cultural",
//       "municipio": "LAS PALMAS DE GRAN CANARIA",
//       "isla": "GRAN CANARIA",
//       "fuente": "asociaciones_canarias",
//       "activa": true,
//       "web": null
//     }
//   }
//
// ── Salida _featureToSilla(...) ──────────────────────────────
//   {
//     id: "silla-as-canarias-3473",
//     source: "civic",
//     source_label: "SILLA VACÍA",
//     kind: "silla_vacia",
//     author: null,
//     body: "ALCOHOLICOS ANONIMOS - GRUPO LAS PALMAS\n" +
//           "Asociación cultural · LAS PALMAS DE GRAN CANARIA · GRAN CANARIA\n\n" +
//           "Esta entidad existe pero nadie vinculado ha firmado en POLIS.",
//     ts: null,
//     geo: {
//       zona: "LAS PALMAS DE GRAN CANARIA",
//       municipio: "LAS PALMAS DE GRAN CANARIA",
//       isla: "GRAN CANARIA",
//       coords: [-15.433964, 28.136947]
//     },
//     payload: <properties crudo>,
//     url_origen: null,
//     dims: { cercania: 0, conocidos: -1, reaccionar: +1, temporalidad: 0 }
//   }
//
// ── detectarReclamadas(gestos) ───────────────────────────────
// Entrada (log local hipotético):
//   [
//     { tipo: "soy_de_entidad",
//       payload: { entidad_id: "as-canarias-3473", validador_tipo: "url",
//                  validador_valor: "https://aagrupolaspalmas.org" },
//       userId: "u_xxx", ts: "2026-05-27T18:00:00Z" },
//     { tipo: "sigue_vivo",
//       payload: { nombre: "DE VECINOS SAN ESTEBAN" },
//       userId: "u_xxx", ts: "2026-05-27T18:05:00Z" },
//     { tipo: "senal", payload: { valor: 1, ambito: "espacio" },
//       userId: "u_xxx", ts: "2026-05-27T18:06:00Z" }  // NO cuenta
//   ]
// Salida:
//   Set {
//     "as-canarias-3473",
//     "nombre:de vecinos san esteban"
//   }
//
// En loadSillasVacias, el feature "as-canarias-3473" quedaría filtrado
// (no aparece en el feed). La entrada "DE VECINOS SAN ESTEBAN" también
// quedaría filtrada aunque no tengamos su id, por el match nombre→nombre.
