// biblioteca-app/libros-store.js — Almacén local de los PDF de la Biblioteca.
//
// Path A (decisión 2026-06-03 con Panch): los PDF viven EN EL NAVEGADOR
// (IndexedDB), no en el repo ni en un backend. Cumple "que no engorde el
// repo", permite anotar en línea y guardar los subrayados como metadatos
// del archivo (esos viven aparte, en localStorage vía recursos-lector).
// Migrar a Supabase (path B) sería cambiar SOLO este adaptador.
//
// Dos object stores:
//   pdfs → el binario (ArrayBuffer), clave = doc_id (SHA-256 del contenido).
//          El hash da dedupe y un ancla estable: re-subir el mismo PDF
//          conserva sus subrayados (que se indexan por doc_id).
//   meta → catálogo { doc_id, titulo, autor, anio, paginas, senda, subtipo,
//          licencia, nombre_archivo, anadido_ts }.
//
// Módulo ES puro, sin dependencias.

const DB_NAME = "biblioteca-libros";
const DB_VER = 1;
const STORE_PDF = "pdfs";
const STORE_META = "meta";

let _dbp = null;
function db() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_PDF)) d.createObjectStore(STORE_PDF);
      if (!d.objectStoreNames.contains(STORE_META)) {
        d.createObjectStore(STORE_META, { keyPath: "doc_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}

// Envuelve una transacción y resuelve con el resultado de la request `fn`.
function tx(store, mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

async function sha256Hex(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Guarda el binario + crea (o respeta) su fila de metadatos. Devuelve la meta.
export async function guardarPDF(file) {
  const buf = await file.arrayBuffer();
  const doc_id = await sha256Hex(buf);
  const existente = await getMeta(doc_id);
  await tx(STORE_PDF, "readwrite", s => s.put(buf, doc_id));
  const meta = existente || {
    doc_id,
    titulo: String(file.name || "Documento").replace(/\.pdf$/i, ""),
    autor: "",
    anio: null,
    paginas: null,
    senda: null,
    subtipo: "libro",
    licencia: "",
    nombre_archivo: file.name || "",
    anadido_ts: Date.now()
  };
  await tx(STORE_META, "readwrite", s => s.put(meta));
  return meta;
}

export async function getMeta(doc_id) {
  return tx(STORE_META, "readonly", s => s.get(doc_id));
}

export async function setMeta(doc_id, patch) {
  const cur = (await getMeta(doc_id)) || { doc_id };
  const next = { ...cur, ...(patch || {}), doc_id };
  await tx(STORE_META, "readwrite", s => s.put(next));
  return next;
}

export async function listarLibros() {
  const all = await tx(STORE_META, "readonly", s => s.getAll());
  return Array.isArray(all) ? all : [];
}

// Devuelve el ArrayBuffer del PDF (o undefined si no está en este navegador).
export async function getPDF(doc_id) {
  return tx(STORE_PDF, "readonly", s => s.get(doc_id));
}

export async function borrarLibro(doc_id) {
  await tx(STORE_PDF, "readwrite", s => s.delete(doc_id));
  await tx(STORE_META, "readwrite", s => s.delete(doc_id));
}
