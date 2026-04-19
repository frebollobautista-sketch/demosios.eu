// ─── Perfil mock para iterar UI antes de cablear Supabase ─────────

import type { Contribucion } from "@/lib/capital/contribuciones";

export type PerfilMock = {
  handle: string;
  nombre: string;
  avatarInicial: string;
  avatarColor: string;
  barrioId?: string;
  municipioId?: string;
  islaId?: string;
  contribuciones: Contribucion[];
};

/** Perfil demo del usuario actual mientras no hay auth real. */
export const PERFIL_DEMO: PerfilMock = {
  handle: "panxo93",
  nombre: "Pancho",
  avatarInicial: "P",
  avatarColor: "#A14B2A",
  islaId: "gran-canaria",
  municipioId: "las-palmas-de-gran-canaria",
  barrioId: "vegueta",
  contribuciones: [
    // 3 recursos + 1 serie de videos iniciada — oikonómos a ergátes.
    { id: "c1", tipo: "recurso_koina", seccionPharos: "el-comun", creada: "2026-03-02" },
    { id: "c2", tipo: "recurso_koina", seccionPharos: "trabajo-4ri", creada: "2026-03-10" },
    { id: "c3", tipo: "recurso_koina", seccionPharos: "medios-desinformacion", creada: "2026-03-18" },
    { id: "c4", tipo: "video_cursus", seccionPharos: "el-comun", creada: "2026-03-22" },
    { id: "c5", tipo: "video_cursus", seccionPharos: "trabajo-4ri", creada: "2026-04-01" },
    { id: "c6", tipo: "hilo_agora", seccionPharos: "el-comun", creada: "2026-03-05" },
    { id: "c7", tipo: "hilo_agora", seccionPharos: "defensa-geopolitica", creada: "2026-03-28" },
    { id: "c8", tipo: "respuesta_agora", seccionPharos: "cambio-climatico", creada: "2026-04-02" },
    { id: "c9", tipo: "respuesta_agora", seccionPharos: "cambio-climatico", creada: "2026-04-03" },
    { id: "c10", tipo: "mapa_pin", creada: "2026-04-05" },
    { id: "c11", tipo: "mapa_pin", creada: "2026-04-05" },
    { id: "c12", tipo: "mapa_pin", creada: "2026-04-10" },
    // 7 PECs recibidos de otros ciudadanos.
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `pec${i + 1}`,
      tipo: "pec_recibido" as const,
      creada: `2026-04-${String(10 + i).padStart(2, "0")}`,
    })),
  ],
};
