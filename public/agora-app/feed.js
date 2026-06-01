// agora-app/feed.js — Cargador unificado de posts para el feed.
//
// Pivot 2026-05-27: el feed deja de ser un agregador GEOGRÁFICO-cívico
// con overlays como ciudadanos de primera, y pasa a ser un feed
// Bluesky-like donde POSTS son la primitiva dominante. Los overlays
// cívicos NO desaparecen — bajan a ser UNA fuente más, normalizada al
// mismo shape `Post` que Bluesky y Reddit.
//
// Tres fuentes, una forma:
//   1. Bluesky (API pública, sin auth, CORS abierto)
//   2. Reddit (JSON públicos, sin auth, CORS habitualmente OK)
//   3. Cívicos locales (los GeoJSON en ../data/, conservados)
//
// Cada fuente normaliza al objeto `Post` (contrato fijado en este
// fichero — no añadir campos a la ligera). El resto de la app (sliders,
// rank, render) ya no necesita saber de qué fuente viene un item.
//
// Tolerancia a fallos: una fuente caída (Reddit por CORS, Bluesky por
// rate-limit, GeoJSON 404) NO tumba al resto. Promise.allSettled
// + console.warn.

import { getAllGestos } from "../shared/gestos.js?v=20260529-agora-verde";
import { clasificar } from "../shared/tablero.js?v=20260529-agora-verde";

// =============================================================
// CONFIGURACIÓN POR DEFECTO
//
// Las apps pueden sobrescribir desde el drawer de ajustes. Los hashtags
// y subreddits son "starter pack" canario — fácilmente editable.

export const DEFAULT_SOURCES_CONFIG = {
  bsky:   { enabled: true, hashtags: ["canarias"], accounts: [] },
  reddit: { enabled: true, subreddits: ["canarias", "spain"] },
  civic:  { enabled: true,
            kinds: ["evento", "productor", "tejido", "cultura",
                    "agora-civic", "parque"] }
};

// =============================================================
// GEO-ANCHOR — Topónimos de Canarias
//
// Lista corta y editable. Se usa para detectar referencias geográficas
// en texto libre (posts de Bluesky/Reddit que mencionan "Vegueta", "La
// Laguna", etc.). El usuario podrá editarla más adelante desde un drawer.

export const TOPONIMOS_CANARIAS = [
  // Gran Canaria — barrios y municipios
  "Vegueta", "Triana", "La Isleta", "Tafira", "Tamaraceite", "Schamann",
  "Las Palmas de Gran Canaria", "Las Palmas",
  "Telde", "Arucas", "Gáldar", "Galdar", "Agaete", "Mogán", "Mogan",
  "Maspalomas", "San Mateo", "Teror", "Firgas", "Santa Brígida",
  "Ingenio", "Agüimes", "Aguimes", "San Bartolomé de Tirajana",
  "Santa Lucía", "Santa Lucia", "Valsequillo", "Moya",
  "Artenara", "Tejeda", "Valleseco", "Carrizal",
  // Tenerife
  "Santa Cruz de Tenerife", "Santa Cruz", "La Laguna", "La Orotava",
  "Puerto de la Cruz", "Adeje", "Arona", "Los Cristianos",
  "Tegueste", "Tacoronte", "Icod",
  // Resto de islas (capitales y nombres de isla)
  "Arrecife", "Lanzarote", "Puerto del Rosario", "Fuerteventura",
  "San Sebastián de la Gomera", "La Gomera", "La Palma", "El Hierro",
  // Archipiélago
  "Canarias", "archipiélago canario"
];

// Mapa barrio→municipio. Sólo para los barrios más reconocibles; el
// resto de topónimos se devuelven con zona = municipio sin más.
const BARRIO_A_MUNICIPIO = {
  "Vegueta":     "Las Palmas de Gran Canaria",
  "Triana":      "Las Palmas de Gran Canaria",
  "La Isleta":   "Las Palmas de Gran Canaria",
  "Tafira":      "Las Palmas de Gran Canaria",
  "Tamaraceite": "Las Palmas de Gran Canaria",
  "Schamann":    "Las Palmas de Gran Canaria",
  "Los Cristianos": "Arona"
};

// Pre-cómputo: normaliza topónimos (sin tildes, minúsculas) y ordena
// por longitud descendente para que "Las Palmas de Gran Canaria" se
// detecte antes que "Las Palmas". La regex se construye una sola vez.
const _norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const _TOP_SORTED = [...TOPONIMOS_CANARIAS].sort((a, b) => b.length - a.length);
const _TOP_NORM   = _TOP_SORTED.map(_norm);
// Regex con word-boundaries laxos (no usamos \b porque las tildes ya
// están quitadas, pero queremos evitar matches dentro de palabras).
const _TOP_REGEX  = new RegExp(
  "(?:^|[^a-z0-9])(" + _TOP_NORM.map(t => t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|") + ")(?:[^a-z0-9]|$)",
  "i"
);

// detectarGeo(texto) — Dado texto libre, devuelve el PRIMER topónimo
// encontrado mapeado a { zona, municipio? } o null si no hay match.
//
// `zona` es el topónimo tal y como aparece en TOPONIMOS_CANARIAS (con
// tildes), no la versión normalizada. `municipio` se rellena cuando la
// zona es un barrio conocido (ver BARRIO_A_MUNICIPIO).
export function detectarGeo(texto) {
  if (!texto || typeof texto !== "string") return null;
  const normTexto = _norm(texto);
  const m = normTexto.match(_TOP_REGEX);
  if (!m) return null;
  const found = m[1];
  // Recuperamos el original (con tildes) mirando el índice en _TOP_NORM.
  const idx = _TOP_NORM.indexOf(found);
  if (idx === -1) return null;
  const zona = _TOP_SORTED[idx];
  const municipio = BARRIO_A_MUNICIPIO[zona];
  return municipio ? { zona, municipio } : { zona };
}

// =============================================================
// FUENTE 1 — BLUESKY
//
// API pública, sin auth, CORS abierto desde browsers. Endpoints
// verificados contra la documentación de AT Protocol (app.bsky.feed.*).
//
// Estrategia: por cada hashtag configurado disparamos un searchPosts;
// por cada cuenta, un getAuthorFeed. Todos en paralelo, allSettled.

const BSKY_BASE = "https://public.api.bsky.app/xrpc";

async function _bskySearchHashtag(hashtag) {
  // searchPosts acepta el hashtag con o sin '#'. Mandamos sin '#' y
  // dejamos que el backend de Bluesky resuelva. Limit 25 → suficiente
  // para alimentar el feed sin saturar.
  const url = `${BSKY_BASE}/app.bsky.feed.searchPosts?q=${encodeURIComponent(hashtag)}&limit=25`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`bsky search ${hashtag}: ${res.status}`);
  const json = await res.json();
  return (json.posts || []).map(_bskyPostToFeed);
}

async function _bskyAuthorFeed(actor) {
  const url = `${BSKY_BASE}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=25`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`bsky author ${actor}: ${res.status}`);
  const json = await res.json();
  // getAuthorFeed devuelve { feed: [{ post, reason?, reply? }] }; el
  // post real está en cada entry.post (mismo shape que searchPosts).
  return (json.feed || []).map(entry => _bskyPostToFeed(entry.post)).filter(Boolean);
}

// Mapea un post crudo de Bluesky al shape Post unificado.
function _bskyPostToFeed(post) {
  if (!post || !post.uri) return null;
  const author = post.author || {};
  const record = post.record || {};
  const handle = author.handle || "desconocido";

  // El URI de bsky es `at://did:plc:xxx/app.bsky.feed.post/RKEY`.
  // Para construir la URL web pública necesitamos sólo el RKEY final.
  const rkey = String(post.uri).split("/").pop();
  const urlOrigen = `https://bsky.app/profile/${handle}/post/${rkey}`;

  // Sanitiza el id para que sea seguro como key de DOM y de localStorage.
  const id = `bsky-${String(post.uri).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  // Media — embed.images si existe; ignoramos vídeos por ahora (el
  // render del feed no los soporta todavía).
  let media;
  if (post.embed?.images?.length) {
    media = post.embed.images.map(img => ({
      url:  img.fullsize || img.thumb,
      type: "image",
      alt:  img.alt || ""
    }));
  }

  const body = record.text || "";
  return {
    id,
    source: "bsky",
    source_label: "BSKY",
    kind: "post",
    author: {
      handle: "@" + handle,
      display: author.displayName || handle,
      avatar_url: author.avatar || undefined
    },
    body,
    ts: record.createdAt || null,
    geo: detectarGeo(body),
    media,
    url_origen: urlOrigen,
    payload: post
  };
}

async function _loadBluesky(cfg) {
  if (!cfg || !cfg.enabled) return [];
  const tasks = [];
  for (const tag of (cfg.hashtags || [])) tasks.push(_bskySearchHashtag(tag));
  for (const acc of (cfg.accounts || [])) tasks.push(_bskyAuthorFeed(acc));
  const settled = await Promise.allSettled(tasks);
  const posts = [];
  for (const r of settled) {
    if (r.status === "fulfilled") posts.push(...r.value.filter(Boolean));
    else console.warn("[feed/bsky] fallo:", r.reason?.message || r.reason);
  }
  return posts;
}

// =============================================================
// FUENTE 2 — REDDIT
//
// Reddit NO es fetcheable desde el navegador: el `.json` devuelve 403
// con Origin (CORS) y el dominio incluso bloquea curl server-side. La
// solución: SNAPSHOTS estáticos copiados vía RSS (tools/snapshot-reddit.py)
// y guardados en ../data/reddit/<sub>.json. El feed los lee como
// ficheros locales — mismo origen, sin CORS, contenido real. Para
// refrescar: re-ejecutar el script de snapshot. Cada item del snapshot:
//   { id, title, author, body, ts, url, subreddit }

async function _redditSubreddit(sub) {
  const url = `../data/reddit/${encodeURIComponent(sub)}.json`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`reddit snapshot r/${sub}: ${res.status}`);
  const items = await res.json();
  return (Array.isArray(items) ? items : []).map(_redditPostToFeed).filter(Boolean);
}

function _redditPostToFeed(it) {
  if (!it || !it.title) return null;
  const body = it.title + (it.body ? "\n\n" + it.body : "");
  const sub = it.subreddit || "reddit";
  return {
    id: `reddit-${it.id || Math.random().toString(36).slice(2, 9)}`,
    source: "reddit",
    source_label: `REDDIT r/${sub}`,
    kind: "post",
    author: { handle: it.author || "u/anónimo" },
    body,
    ts: it.ts || null,
    geo: detectarGeo(body),
    url_origen: it.url || null,
    payload: it
  };
}

async function _loadReddit(cfg) {
  if (!cfg || !cfg.enabled) return [];
  const tasks = (cfg.subreddits || []).map(s => _redditSubreddit(s));
  const settled = await Promise.allSettled(tasks);
  const posts = [];
  for (const r of settled) {
    if (r.status === "fulfilled") posts.push(...r.value);
    // Snapshot ausente (subreddit no copiado aún) → silencioso. Para
    // añadirlo: agregarlo a SUBS en tools/snapshot-reddit.py y re-correr.
    else console.warn("[feed/reddit] snapshot ausente:", r.reason?.message || r.reason);
  }
  return posts;
}

// =============================================================
// FUENTE 3 — CÍVICOS LOCALES
//
// Los 6 overlays GeoJSON que ya cargaba la versión anterior. NO
// importamos los módulos de polis-app/overlays/*.js porque dependen de
// iso.js (proyección isométrica/canvas). En su lugar fetcheamos los
// GeoJSON canónicos directamente — los overlays son sólo cajas de
// presentación sobre los mismos datos públicos en `../data/`.
//
// Cada parser devuelve directamente objetos Post (no items intermedios
// como en la versión anterior). De este modo el resto del pipeline trata
// cívicos y posts externos de la misma forma.

const SOURCE_LABELS_CIVIC = {
  "evento":      "EVENTO",
  "productor":   "PRODUCTOR",
  "tejido":      "TEJIDO",
  "cultura":     "CULTURA",
  "agora-civic": "ÁGORA",
  "parque":      "PARQUE"
};

// Helper: construye el geo de un feature GeoJSON cuando hay coords y/o
// campos municipio/isla en properties.
function _civicGeo(feature, props) {
  const coords = feature.geometry?.type === "Point"
    ? feature.geometry.coordinates
    : null;
  if (!coords && !props.municipio && !props.isla) return null;
  const g = {};
  if (props.municipio) g.municipio = props.municipio;
  if (props.isla) g.isla = props.isla;
  if (coords && coords.length >= 2) g.coords = [coords[0], coords[1]];
  // `zona` es obligatorio en el contrato; cuando no hay barrio
  // declarado, usamos municipio como zona, y si tampoco hay, la isla.
  g.zona = props.municipio || props.isla || "Canarias";
  return g;
}

const CIVIC_SOURCES = [
  {
    kind: "evento",
    url:  "../data/events-cultural.geojson",
    parse: (json) => (json.features || [])
      .filter(f => f.geometry?.type === "Point")
      .map(f => {
        const p = f.properties || {};
        const name = p.titulo || "Evento sin título";
        const extras = [p.categoria, p.lugar, p.municipio, p.fecha]
          .filter(Boolean).join(" · ");
        return {
          id: p.id || `evt-${Math.random().toString(36).slice(2,8)}`,
          source: "civic",
          source_label: "EVENTO",
          kind: "evento",
          author: null,
          body: name + (extras ? " · " + extras : "") +
                (p.descripcion ? "\n\n" + p.descripcion : ""),
          ts: p.fecha || null,
          geo: _civicGeo(f, p),
          payload: p
        };
      })
  },
  {
    kind: "productor",
    url:  "../data/productores-locales.geojson",
    parse: (json) => (json.features || [])
      .filter(f => f.geometry?.type === "Point")
      .map(f => {
        const p = f.properties || {};
        const name = p.nombre || "Productor";
        const extras = [p.oficio, p.municipio].filter(Boolean).join(" · ");
        return {
          id: p.id || `prod-${Math.random().toString(36).slice(2,8)}`,
          source: "civic",
          source_label: "PRODUCTOR",
          kind: "productor",
          author: null,
          body: name + (extras ? " · " + extras : "") +
                (p.que_hace ? "\n\n" + p.que_hace : ""),
          ts: null,
          geo: _civicGeo(f, p),
          payload: p
        };
      })
  },
  {
    kind: "tejido",
    url:  "../data/tejido-social-canarias-v2.geojson",
    // 3926 entidades — limitamos a las primeras 300 para no inundar el
    // feed. El ranking elegirá las relevantes. TODO: filtro por isla
    // cuando llegue geolocalización del usuario.
    parse: (json) => (json.features || [])
      .filter(f => f.geometry?.type === "Point")
      .slice(0, 300)
      .map(f => {
        const p = f.properties || {};
        const name = p.nombre || "Entidad";
        const extras = [p.categoria, p.municipio, p.isla].filter(Boolean).join(" · ");
        return {
          id: p.id || `tej-${Math.random().toString(36).slice(2,8)}`,
          source: "civic",
          source_label: "TEJIDO",
          kind: "tejido",
          author: null,
          body: name + (extras ? " · " + extras : ""),
          ts: null,
          geo: _civicGeo(f, p),
          payload: p
        };
      })
  },
  {
    kind: "cultura",
    url:  "../data/cultura-venues.geojson",
    parse: (json) => (json.features || [])
      .filter(f => f.geometry?.type === "Point")
      .slice(0, 200)
      .map(f => {
        const p = f.properties || {};
        const name = p.name || "Espacio cultural";
        const extras = [p.categoria, p.operator].filter(Boolean).join(" · ");
        const horario = p.opening_hours ? `Horario: ${p.opening_hours}` : "";
        return {
          id: p.osm_id || `cv-${Math.random().toString(36).slice(2,8)}`,
          source: "civic",
          source_label: "CULTURA",
          kind: "cultura",
          author: null,
          body: name + (extras ? " · " + extras : "") +
                (horario ? "\n\n" + horario : ""),
          ts: null,
          geo: _civicGeo(f, p),
          payload: p
        };
      })
  },
  {
    kind: "agora-civic",
    url:  "../data/agora-canarias.geojson",
    parse: (json) => (json.features || [])
      .filter(f => f.geometry?.type === "Point")
      .slice(0, 200)
      .map(f => {
        const p = f.properties || {};
        const name = p.name || "Punto ágora";
        const extras = [p.kind, p.subtype].filter(Boolean).join(" · ");
        return {
          // agora-canarias no tiene id estable → componemos uno.
          id: `ag-${p.kind}-${p.name || Math.random().toString(36).slice(2,8)}`
                .replace(/\s+/g, "-").slice(0, 80),
          source: "civic",
          source_label: "ÁGORA",
          kind: "agora-civic",
          author: null,
          body: name + (extras ? " · " + extras : ""),
          ts: null,
          geo: _civicGeo(f, p),
          payload: p
        };
      })
  },
  {
    kind: "parque",
    // parques.js carga 2 ficheros: GC y prov38 (TF/LP/EH/LG). Cargamos
    // sólo GC porque es el más rico (12.881 polígonos). Filtramos a los
    // park/garden/playground con nombre (la mayoría son anónimos).
    // TODO prov38: añadir si se quiere cobertura archipiélago.
    // 2026-06-01 — osm-gc vive en R2 (no en el repo). Ágora no tiene el
    // wiring __ASSETS_BASE de polis-app, así que apuntamos directo al
    // Custom Domain de R2 (CORS ya permite www/apex demosios.eu).
    url: "https://packs.demosios.eu/osm-gc/parks.json",
    parse: (json) => (json.features || [])
      .filter(f => {
        const t = f.properties?.type;
        return (t === "park" || t === "garden" || t === "playground") &&
               !!f.properties?.name;
      })
      .slice(0, 100)
      .map(f => {
        const p = f.properties || {};
        return {
          id: `park-${p.name}`.replace(/\s+/g, "-").slice(0, 80),
          source: "civic",
          source_label: "PARQUE",
          kind: "parque",
          author: null,
          body: p.name + (p.type ? " · " + p.type : ""),
          ts: null,
          geo: _civicGeo(f, p),
          payload: p
        };
      })
  }
];

async function _loadCivic(cfg) {
  if (!cfg || !cfg.enabled) return [];
  const kindsActivos = new Set(cfg.kinds || []);
  const activos = CIVIC_SOURCES.filter(s => kindsActivos.has(s.kind));
  const settled = await Promise.allSettled(
    activos.map(src =>
      fetch(src.url, { cache: "no-cache" })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`${src.kind} ${r.status}`)))
        .then(json => src.parse(json))
    )
  );
  const posts = [];
  for (let i = 0; i < activos.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") posts.push(...r.value);
    else console.warn(`[feed/civic] ${activos[i].kind} fallo:`, r.reason?.message || r.reason);
  }
  return posts;
}

// =============================================================
// loadAllSources(config) — Orquestador.
//
// Lanza las 3 fuentes en paralelo. Cada una ya es tolerante a fallos
// internamente; si una entera explota, capturamos aquí también.
//
// Devuelve Promise<Post[]> — array de posts ya normalizados pero SIN
// dims calculadas (eso lo hace aplicarDims, que necesita leer el log
// de gestos para 'conocidos').

export async function loadAllSources(config = DEFAULT_SOURCES_CONFIG) {
  const cfg = config || DEFAULT_SOURCES_CONFIG;
  const settled = await Promise.allSettled([
    _loadBluesky(cfg.bsky),
    _loadReddit(cfg.reddit),
    _loadCivic(cfg.civic)
  ]);
  const posts = [];
  const fuentes = ["bsky", "reddit", "civic"];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") posts.push(...r.value);
    else console.warn(`[feed] fuente ${fuentes[i]} colapsada:`, r.reason?.message || r.reason);
  }
  return posts;
}

// =============================================================
// aplicarDims(posts) — Calcula las 4 dimensiones por post.
//
// PURA sobre los posts crudos pero LEE getAllGestos() del localStorage
// para calcular 'conocidos' (interacciones previas del usuario).
//
// Reglas:
//   cercania     → +0.5 si geo.municipio coincide con municipio de
//                   algún gesto previo; 0 si geo presente sin match;
//                   -0.5 si geo===null.
//                  (TODO: cuando llegue navigator.geolocation, calcular
//                   por haversine y este score se hace continuo).
//   conocidos    → +1 si author.handle aparece en gestos previos, O si
//                   geo.municipio aparece en zona de gestos previos;
//                   -1 si nunca antes.
//   reaccionar   → +1 si kind ∈ {evento, agora-civic} o body contiene
//                   call-to-action; -1 si kind ∈ {productor, parque,
//                   cultura} o body parece opinión pura; 0 mixto
//                   (posts externos sin CTA obvio).
//   temporalidad → +1 si ts futuro; 0 si < 7 días; -0.5 si < 30 días;
//                  -1 si > 30 días o null.

const CTA_REGEX = /\b(asamblea|convocamos|convocatoria|manifestación|manifestacion|reunión|reunion|necesitamos|ven|súmate|sumate|apúntate|apuntate|firma)\b/i;

export function aplicarDims(posts) {
  const gestos = getAllGestos();

  // Set de handles y zonas previamente "tocadas" por el usuario. Los
  // gestos clásicos no guardan handle, pero los futuros gestos sobre
  // posts externos sí podrán hacerlo en payload.author_handle.
  const handlesPrevios = new Set();
  const zonasPrevias   = new Set();
  for (const g of gestos) {
    if (g.falso) continue;
    if (g?.zona) zonasPrevias.add(String(g.zona));
    if (g?.payload?.municipio) zonasPrevias.add(String(g.payload.municipio));
    if (g?.payload?.author_handle) handlesPrevios.add(String(g.payload.author_handle));
  }

  const ahora = Date.now();
  const SIETE_DIAS  = 7 * 24 * 3600 * 1000;
  const TREINTA_DIAS = 30 * 24 * 3600 * 1000;

  return posts.map(p => {
    // ── cercanía ─────────────────────────────────────────────
    let cercania;
    if (!p.geo) {
      cercania = -0.5;
    } else {
      const muni = p.geo.municipio || p.geo.zona;
      cercania = (muni && zonasPrevias.has(muni)) ? +0.5 : 0;
    }

    // ── conocidos ────────────────────────────────────────────
    const handle = p.author?.handle;
    const muniPost = p.geo?.municipio || p.geo?.zona;
    const conocido = (handle && handlesPrevios.has(handle)) ||
                     (muniPost && zonasPrevias.has(muniPost));
    const conocidos = conocido ? +1 : -1;

    // ── reaccionar ───────────────────────────────────────────
    // Kind drive: eventos y ágoras son call-to-action por naturaleza;
    // productores/parques/cultura son info estática.
    let reaccionar;
    if (p.kind === "evento" || p.kind === "agora-civic") {
      reaccionar = +1;
    } else if (p.kind === "productor" || p.kind === "parque" || p.kind === "cultura") {
      reaccionar = -1;
    } else {
      // post (bsky/reddit) o tejido: depende del body.
      reaccionar = CTA_REGEX.test(p.body || "") ? +1 : 0;
    }

    // ── temporalidad ─────────────────────────────────────────
    let temporalidad;
    if (!p.ts) {
      temporalidad = -1;
    } else {
      const t = Date.parse(p.ts);
      if (!Number.isFinite(t)) {
        temporalidad = -1;
      } else if (t > ahora) {
        temporalidad = +1;
      } else {
        const edad = ahora - t;
        if (edad < SIETE_DIAS)        temporalidad = 0;
        else if (edad < TREINTA_DIAS) temporalidad = -0.5;
        else                          temporalidad = -1;
      }
    }

    // Dims temáticas del tablero (hobby + cívico). rank() solo usará las
    // dims cuyos sliders existen en la familia activa; las posturales
    // (cercania/temporalidad…) quedan como insumo de orden interno, sin
    // slider de usuario que las pondere.
    const temas = clasificar(p);

    return {
      ...p,
      dims: { cercania, conocidos, reaccionar, temporalidad, ...temas }
    };
  });
}

// =============================================================
// MINI-TEST DOCUMENTAL (no se ejecuta)
//
// El siguiente bloque es documentación viva — pega ejemplos de
// entrada/salida esperada para que cualquiera que lea el módulo pueda
// validar su mapeo sin tener que correr la app entera.
//
// ── Ejemplo 1: post crudo de Bluesky → Post ──────────────────
// Entrada (respuesta searchPosts):
//   {
//     uri: "at://did:plc:abc/app.bsky.feed.post/3khxyz",
//     cid: "bafy...",
//     author: { did: "did:plc:abc", handle: "ana.bsky.social",
//               displayName: "Ana", avatar: "https://..." },
//     record: { text: "Asamblea hoy en Vegueta a las 18h",
//               createdAt: "2026-05-27T10:00:00Z" },
//     embed: { images: [{ thumb: "...", fullsize: "...", alt: "cartel" }] }
//   }
// Salida (Post):
//   {
//     id: "bsky-at___did_plc_abc_app_bsky_feed_post_3khxyz",
//     source: "bsky",
//     source_label: "BSKY",
//     kind: "post",
//     author: { handle: "@ana.bsky.social", display: "Ana",
//               avatar_url: "https://..." },
//     body: "Asamblea hoy en Vegueta a las 18h",
//     ts: "2026-05-27T10:00:00Z",
//     geo: { zona: "Vegueta", municipio: "Las Palmas de Gran Canaria" },
//     media: [{ url: "...", type: "image", alt: "cartel" }],
//     url_origen: "https://bsky.app/profile/ana.bsky.social/post/3khxyz",
//     payload: <post crudo>
//   }
//
// ── Ejemplo 2: detectarGeo ───────────────────────────────────
//   detectarGeo("Asamblea hoy en Vegueta a las 18h")
//   → { zona: "Vegueta", municipio: "Las Palmas de Gran Canaria" }
//
//   detectarGeo("Comemos en La Laguna")
//   → { zona: "La Laguna" }
//
//   detectarGeo("Hablando de la situación general")
//   → null
//
// ── Ejemplo 3: aplicarDims sobre 2 posts mock ────────────────
// Entrada:
//   posts = [
//     { id: "a", kind: "evento", body: "Convocamos asamblea",
//       ts: "2026-06-01T18:00:00Z", geo: { zona: "Vegueta",
//       municipio: "Las Palmas de Gran Canaria" },
//       author: null, source: "civic" },
//     { id: "b", kind: "post",   body: "Hoy tarde llueve.",
//       ts: "2026-05-26T08:00:00Z", geo: null,
//       author: { handle: "@randos" }, source: "bsky" }
//   ]
// Salida (asumiendo log de gestos vacío):
//   a.dims = { cercania:  0,    conocidos: -1, reaccionar: +1,
//              temporalidad: +1 }   // fecha futura
//   b.dims = { cercania: -0.5, conocidos: -1, reaccionar:  0,
//              temporalidad:  0 }   // hace 1 día, < 7d
