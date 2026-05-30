// ─── Lógos — tipos compartidos ──────────────────────────────────
// Reflejan 1:1 las tablas SQL definidas en
// supabase/migrations/20260503000000_logos.sql.
//
// Lógos es la sub-página "palabra" de la pestaña Ágora: posts de
// texto / cita / audio. Decisiones rectoras:
//  · PEC con dos niveles: silencioso + público
//  · Like eliminado
//  · Comentarios como subposts encadenados que NO suben al feed
//  · Transcripción automática de audio vía Whisper

export type LogosPostTipo = "texto" | "cita" | "audio";
export type LogosPecNivel = "silencioso" | "publico";

export type LogosPost = {
  id: string;
  autor_id: string;
  tipo: LogosPostTipo;
  cuerpo: string | null;
  cita_autor: string | null;
  cita_fuente: string | null;
  audio_url: string | null;
  audio_duracion_seg: number | null;
  seccion_pharos: string | null;
  isla_id: string | null;
  municipio_id: string | null;
  barrio_id: string | null;
  es_ai: boolean;
  ai_etiqueta: string | null;
  retirado: boolean;
  retirado_en: string | null;
  pec_silencioso_count: number;
  pec_publico_count: number;
  comentario_count: number;
  creado: string;
  actualizado: string;
};

export type AutorMini = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type LogosPostConAutor = LogosPost & {
  autor: AutorMini | null;
  /** Si el lector ha dado PEC, su nivel; null si no. */
  mi_pec_nivel?: LogosPecNivel | null;
};

export type LogosComentario = {
  id: string;
  post_id: string;
  parent_id: string | null;
  autor_id: string;
  cuerpo: string;
  pec_silencioso_count: number;
  pec_publico_count: number;
  retirado: boolean;
  retirado_en: string | null;
  creado: string;
  actualizado: string;
};

export type LogosComentarioConAutor = LogosComentario & {
  autor: AutorMini | null;
};

/** Comentario aumentado con sus hijos en árbol. */
export type LogosComentarioArbol = LogosComentarioConAutor & {
  hijos: LogosComentarioArbol[];
};

export type LogosTranscripcion = {
  id: string;
  post_id: string;
  texto: string;
  idioma: string;
  generado_por: string;
  confianza: number | null;
  creado: string;
};

/** Filtros aceptados al listar posts del feed Lógos. */
export type LogosFiltrosListado = {
  tipo?: LogosPostTipo;
  seccion?: string;
  isla?: string;
  municipio?: string;
  barrio?: string;
  autor?: string;
  /** orden por defecto: cronológico descendente */
  orden?: "recientes" | "actualizados";
  limite?: number;
  desplazamiento?: number;
};

/** PECs públicos sobre un post — para mostrar avatares apilados. */
export type LogosPecPublicoConAvatar = {
  user_id: string;
  handle: string;
  avatar_url: string | null;
  creado: string;
};
