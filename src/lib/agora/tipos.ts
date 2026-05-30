// ─── Ágora — tipos compartidos ──────────────────────────────────
// Reflejan 1:1 las tablas SQL definidas en
// supabase/migrations/20260502000000_agora.sql.

export type AgoraModo = "debate" | "propuesta_decidim" | "consenso_polis";
export type AgoraEstado = "abierto" | "archivado" | "cerrado";
export type AgoraVotoBinario = "a_favor" | "en_contra" | "abstencion";
export type AgoraVotoTernario = "de_acuerdo" | "desacuerdo" | "pasar";
export type AgoraResultado = "aprobada" | "rechazada" | "sin_quorum" | "empate";

export type Hilo = {
  id: string;
  autor_id: string;
  titulo: string;
  cuerpo: string;
  seccion_pharos: string;
  categoria_local: string | null;
  isla_id: string | null;
  municipio_id: string | null;
  barrio_id: string | null;
  modo: AgoraModo;
  estado: AgoraEstado;
  fijado: boolean;
  pec_count: number;
  comentario_count: number;
  creado: string;
  actualizado: string;
};

export type HiloConAutor = Hilo & {
  autor: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type Comentario = {
  id: string;
  hilo_id: string;
  parent_id: string | null;
  autor_id: string;
  cuerpo: string;
  pec_count: number;
  creado: string;
};

export type ComentarioConAutor = Comentario & {
  autor: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** Comentario aumentado con sus hijos en árbol. */
export type ComentarioArbol = ComentarioConAutor & {
  hijos: ComentarioArbol[];
};

export type Decision = {
  id: string;
  hilo_id: string;
  texto: string;
  fundamentacion: string | null;
  fecha_cierre: string;
  quorum_minimo: number | null;
  resultado: AgoraResultado | null;
  creado: string;
};

export type Propuesta = {
  id: string;
  hilo_id: string;
  autor_id: string;
  texto: string;
  aprobada_para_votar: boolean;
  creado: string;
};

export type ConteoVotosBinario = {
  a_favor: number;
  en_contra: number;
  abstencion: number;
  total: number;
};

export type ConteoVotosTernario = {
  de_acuerdo: number;
  desacuerdo: number;
  pasar: number;
  total: number;
};

/** Filtros aceptados al listar hilos. */
export type FiltrosListado = {
  seccion: string; // obligatoria
  categoria?: string;
  isla?: string;
  municipio?: string;
  barrio?: string;
  orden?: "recientes" | "actividad" | "pec";
  limite?: number;
  desplazamiento?: number;
};
