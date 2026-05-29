# AGORA-DATA-MODEL.md — DOCUMENTO MOVIDO

> Este documento describía el modelo de datos del foro de debate cuando ese módulo se llamaba "Ágora" (sesión del 2 mayo 2026).
>
> Tras la decisión arquitectónica del 2026-05-03 de usar los nombres griegos clásicos en el toggle de la app, el debate vive ahora bajo Bibliotheka, y el nombre Ágora se reasigna al módulo del YO (FEED + TOUCH).
>
> El contenido se ha movido a:
>
> **→ [`BIBLIOTHEKA-DEBATE-DATA-MODEL.md`](./BIBLIOTHEKA-DEBATE-DATA-MODEL.md)**
>
> El nuevo modelo de datos para Ágora (módulo del YO) se documentará junto con su inventario en [`AGORA-FUNCIONALIDADES.md`](./AGORA-FUNCIONALIDADES.md) y futuros docs.
>
> Las tablas SQL existentes mantienen el prefijo `agora_*` por compatibilidad con la migración ya escrita (`supabase/migrations/20260502000000_agora.sql`); pueden renombrarse en una migración futura sin urgencia.

Ver también:
- [`AGORA-FUNCIONALIDADES.md`](./AGORA-FUNCIONALIDADES.md) — inventario nuevo (módulo del YO)
- [`BIBLIOTHEKA-DEBATE.md`](./BIBLIOTHEKA-DEBATE.md) — inventario del debate
- [`IDEAS.md → Arquitectura del proyecto`](./IDEAS.md#arquitectura-del-proyecto) — decisión arquitectónica
