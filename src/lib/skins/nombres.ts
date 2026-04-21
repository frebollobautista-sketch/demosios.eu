// ─── Skins de nomenclatura ──────────────────────────────────────
// Demos iOS soporta dos registros de nombres:
//
//   · "griego"  — registro por defecto. Las secciones se llaman por
//     su nombre clásico: Ágora, Bibliotheka, Polis. Los ejes de capital
//     mantienen su nombre griego (Koinonía, Paideía, Politeía).
//
//   · "latino"  — "modo aventura". Las mismas secciones en latín, para
//     cuando el usuario quiera habitar la plataforma como una república
//     romana. El cursus honorum ya es latino por diseño, así que encaja
//     sin fricción.
//
// No hay cambio de URLs: los slugs siguen siendo /agora /bibliotheka /polis.
// Solo cambian las etiquetas visibles. Esto permite activar/desactivar el
// skin con un toggle, sin reescribir rutas ni romper enlaces externos.

export type Skin = "griego" | "latino";

export type SeccionNombre = {
  /** Slug interno — no cambia con el skin. Usado en routing. */
  slug: "inicio" | "agora" | "bibliotheka" | "polis";
  /** Nombre en la skin griega (actual). */
  griego: string;
  /** Forma original en alfabeto griego — para tooltip / caption. */
  griegoOriginal: string;
  /** Nombre en la skin latina ("modo aventura"). */
  latino: string;
  /** Traducción castellana breve para subtítulo. */
  traduccion: string;
};

export const SECCIONES_SKIN: SeccionNombre[] = [
  {
    slug: "inicio",
    griego: "Inicio",
    griegoOriginal: "",
    latino: "Ingressus",
    traduccion: "entrada",
  },
  {
    slug: "agora",
    griego: "Ágora",
    griegoOriginal: "Ἀγορά",
    latino: "Forum",
    traduccion: "plaza de deliberación",
  },
  {
    slug: "bibliotheka",
    griego: "Bibliotheka",
    griegoOriginal: "Βιβλιοθήκη",
    latino: "Bibliotheca",
    traduccion: "casa de los recursos del común",
  },
  {
    slug: "polis",
    griego: "Polis",
    griegoOriginal: "Πόλις",
    latino: "Civitas",
    traduccion: "ciudad como comunidad de ciudadanos",
  },
];

/**
 * Los ejes de capital también tienen equivalente latino.
 * Pensados para activarse solo con el modo aventura — por defecto
 * seguimos usando griego en todos los lugares del código.
 */
export const EJES_SKIN: Array<{
  id: "koinonia" | "paideia" | "politeia";
  griego: string;
  latino: string;
}> = [
  { id: "koinonia", griego: "Κοινωνία", latino: "Communitas" },
  { id: "paideia", griego: "Παιδεία", latino: "Eruditio" },
  { id: "politeia", griego: "Πολιτεία", latino: "Res Publica" },
];

/**
 * Los sub-apartados de Bibliotheka también se traducen:
 *   · Cursus honorum → ya es latino, se mantiene.
 *   · τὰ Κοινά → Res Communes (las cosas comunes, en latín).
 */
export const KOINA_LATINO = {
  griego: "τὰ Κοινά",
  latino: "Res Communes",
};

/** Devuelve el nombre visible de una sección según el skin activo. */
export function nombreSeccion(slug: SeccionNombre["slug"], skin: Skin): string {
  const s = SECCIONES_SKIN.find((x) => x.slug === slug)!;
  return skin === "latino" ? s.latino : s.griego;
}
