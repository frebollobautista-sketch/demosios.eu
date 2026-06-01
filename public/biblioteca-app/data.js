// biblioteca-app/data.js — Carga y normalización de los 21 ficheros
// resumen_t{1..21}.json en items planos del feed. Mapea cada item a
// `dims` (vector que los sliders puntúan en rank.js).
//
// Heurísticas de mapeo item→dims (decisiones provisionales,
// documentadas para revisión):
//
//   dominio    → 0 para todos. Sin SRS no podemos saber qué dominas
//                vs. qué está en tu frontera. El usuario que mueva el
//                slider a "dominio" o "frontera" no notará nada hasta
//                que el scheduler exista. TODO: integrar con shared/loops
//                detectarDominioRetenido cuando el SRS esté en sitio.
//
//   canonico   → -1 (TODOS los items son canónicos por origen).
//                Vienen de mnemoHACK → /data/biblioteca/ — son los
//                temarios oficiales. Los críticos vivirán en LIBROS
//                (NotebookLM, post-MVP) y entrarán como items con
//                dim canonico = +1. TODO: ingest LIBROS.
//
//   compania   → -1 (solitario por defecto). No hay material
//                colaborativo todavía — las síntesis del usuario y los
//                gestos compartidos llegarán post-MVP. TODO.
//
//   navegacion → dinámico, depende del "último tema visto" (state).
//                Items del MISMO tema que el último visto = -1 (vertical,
//                profundiza en lo que estás leyendo).
//                Items de OTROS temas = +1 (horizontal, salta).
//                Sin último visto = 0 (neutral).
//
// La función mapearDims() acepta `ultimoTema` y devuelve el dim por
// item — la app la llama en cada re-rank para reflejar la navegación.

const N_TEMAS = 21;

export async function cargarItems() {
  const ids = Array.from({ length: N_TEMAS }, (_, i) => i + 1);
  const promesas = ids.map(n =>
    fetch(`../data/biblioteca/resumen_t${n}.json`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  );
  const resultados = await Promise.all(promesas);
  const items = [];
  for (const arr of resultados) {
    if (!Array.isArray(arr)) continue;
    for (const epi of arr) {
      if (!epi || !epi.tema_id || !epi.epi_id) continue;
      items.push({
        id: epi.tema_id + ":" + epi.epi_id,
        kind: "epigrafe",
        tema_id: epi.tema_id,
        epi_id: epi.epi_id,
        resumen_html: epi.resumen || "",
        // dims se calculan dinámicamente vía mapearDims(); aquí dejamos
        // los componentes estáticos. dominio/canonico/compania son
        // constantes (decisión MVP); navegacion es dinámico.
        _dims_estaticas: {
          dominio: 0,    // TODO SRS
          canonico: -1,  // todos canónicos
          compania: -1   // todos solitarios
        }
      });
    }
  }
  return items;
}

// Aplica el componente dinámico (navegacion) a cada item según el
// último tema visto. Pura — devuelve nuevos objetos con `dims`
// completo. La app llama esto antes de `rank()`.
export function mapearDims(items, ultimoTemaId) {
  return items.map(item => {
    let nav = 0;
    if (ultimoTemaId) {
      nav = (item.tema_id === ultimoTemaId) ? -1 : +1;
    }
    return {
      ...item,
      dims: {
        ...item._dims_estaticas,
        navegacion: nav
      }
    };
  });
}

// ─────────── Touchbar v2 — loaders por lente de compromiso ───────────
// 2026-05-30: Los chips Píldora y Hilo cargan colecciones separadas
// (no se mezclan con epígrafes en state.items, para mantener rank()
// limpio por lente y paginación independiente). Si el JSON no existe
// o es inválido, devolvemos [] silenciosamente — el feed muestra el
// empty-invite normal sin caída.

export async function cargarPildoras() {
  try {
    const arr = await fetch("../data/biblioteca/seed-pildoras.json")
      .then(r => r.ok ? r.json() : []);
    if (!Array.isArray(arr)) return [];
    return arr.filter(p => p && p.id && p.kind === "pildora").map(p => ({
      ...p,
      // dims por defecto si el seed no las trae explícitas. Las píldoras
      // son cortas y mixtas en origen (canónicas y críticas conviven en
      // el mismo chip): dejamos los tres ejes en cero excepto compañía,
      // que es solitaria por naturaleza (las lees tú solo).
      _dims_estaticas: p._dims_estaticas || {
        dominio: 0, canonico: 0, compania: -1
      }
    }));
  } catch { return []; }
}

export async function cargarHilos() {
  try {
    const arr = await fetch("../data/biblioteca/seed-hilos.json")
      .then(r => r.ok ? r.json() : []);
    if (!Array.isArray(arr)) return [];
    return arr.filter(h => h && h.id && h.kind === "hilo").map(h => ({
      ...h,
      // Los hilos son editoriales del equipo OCRE: canónicos por
      // curaduría propia, solitarios por defecto (lectura individual;
      // si entran en un quórum de lectura, el módulo correspondiente
      // se encarga de mostrar la dimensión social).
      _dims_estaticas: h._dims_estaticas || {
        dominio: 0, canonico: -1, compania: -1
      }
    }));
  } catch { return []; }
}

// Aplica navegacion dinámico (mismo patrón que mapearDims de epígrafes)
// a una colección arbitraria de items con campo `tags` o `asignatura_id`.
// Por ahora la navegacion para píldoras/hilos = 0 (sin "último visto"
// equivalente todavía; pasaremos a usar última asignatura visitada
// cuando exista el catálogo de asignaturas cableado).
export function mapearDimsGenerico(items) {
  return items.map(item => ({
    ...item,
    dims: { ...item._dims_estaticas, navegacion: 0 }
  }));
}

// Strip HTML para preview corto. Conserva texto, descarta etiquetas.
// Usado en cards colapsadas y en el dropdown de fuentes del modal de
// síntesis.
export function stripHtml(html, maxLen) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  let txt = (tmp.textContent || tmp.innerText || "").trim();
  if (maxLen && txt.length > maxLen) {
    txt = txt.slice(0, maxLen).trimEnd() + "…";
  }
  return txt;
}
