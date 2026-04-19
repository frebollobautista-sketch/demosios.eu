# IDEAS — captura del flow del chat

Todo lo que se dice en el chat y no se acaba operando en el mismo turno vive aquí. Formato mínimo:

```
### Fecha — título corto
Contexto de una línea. Decisión pendiente o siguiente paso.
```

---

## Sin clasificar

### 2026-04-19 — Preview renderizable dentro de Cowork
El usuario pidió ver el proyecto en preview sin levantar `npm run dev`. Se generó `ocre-preview.html` en la raíz del proyecto como preview autocontenido (vanilla JS, sin deps) para poder abrirlo directamente. Mantener actualizado cuando cambien las secciones principales.

### 2026-04-19 — Silenciar warning de lockfiles múltiples
Next.js 16 detecta `/Users/panch/package-lock.json` como workspace root. Se fijó `turbopack.root` en `next.config.ts` apuntando al directorio del proyecto. Si aparece en otro proyecto, aplicar el mismo patrón.

## UI / UX

### 2026-04-19 — Candado de privacidad en Ajustes (público/privado del perfil)
En el menú del engranaje (icono superior derecho) añadir un toggle con candado que vuelva el perfil público o privado. Cuando esté privado, mostrar un candado pequeño junto al avatar (tanto en el banner flotante como en la cabecera del perfil) y, en la versión real, ocultar el perfil en Ágora/Polis a quienes no sigas. Implementado ya como prototipo en `ocre-preview.html`; pendiente de cablear en `src/app/ajustes/page.tsx` y en la tabla `profiles` cuando conectemos Supabase (columna `is_public boolean default true`).

### 2026-04-19 — Atributos del cursus honorum: explorar tanto visuales como correspondencias profesionales reales
Propuesta implementada con 7 grados griegos + campo `correspondenciaProfesional`. Falta iterar visualmente: ¿conviene ilustraciones tipo grabado romano sobrio en lugar de símbolos tipográficos (○, ⬡, ◆…)? Probar un segundo set con siluetas de figuras clásicas (togada, laurel, escudo redondo). Posible track paralelo: `poietés` para artistas.

### 2026-04-19 — Banner flotante del avatar: minimización e invisibilidad
Implementado con dos niveles (minimizar → solo avatar; ocultar → desaparece). Falta: recuerdo de la preferencia en localStorage y reapertura desde el icono de perfil del header.

### 2026-04-19 — Suscripción email: persistencia entre rutas
Implementada con `localStorage` vía `useSyncExternalStore` para evitar setState-en-effect de React 19. Si el usuario descarta el banner, al pulsar el icono de correo del header se reabre; tras cerrar con la X vuelve a icono mínimo inferior-izquierda.

## Despliegue

### 2026-04-19 — Dominio: demosios.eu (δημόσιος = "público")
Comprado en DonDominio. Decisión: mantener el registro en DonDominio (precio EU, sin valor migrar), hospedar Next.js en Vercel (free tier suficiente), conectar ambos por DNS (no transfer). SSL lo emite Vercel solo. Runbook completo en [`docs/DEPLOY.md`](./DEPLOY.md). Metadatos y Open Graph de la app ya actualizados en `src/app/layout.tsx`.

### 2026-04-19 — Conectores MCP sugeridos: Supabase y Vercel
Ambos servicios tienen MCP oficial. Conectarlos desde Cowork significa que Claude puede listar proyectos, aplicar migraciones, consultar logs de despliegue y cambiar variables de entorno sin pedir tokens sueltos ni tocar el navegador. GitHub no tiene MCP oficial (sí GitLab / Codeberg); alternativa: `gh auth login` en el sandbox por sesión, o token PAT en `.env.local`.

### 2026-04-19 — Auth y BBDD: Supabase nuevo proyecto para OCRE
Reutilizamos el patrón de KOINOS (`@supabase/ssr`), pero proyecto Supabase separado para no entremezclar datos con KOINOS mientras iteramos. Auth: magic link + Google OAuth como mínimo. Password clásico evitado. Apple OAuth cuando haya app móvil.

### 2026-04-19 — Escalado 0 → ~2.4M usuarios
Supabase Pro cubre hasta ~500k-1M MAUs cómodamente. Para 2.4M se queda en Supabase Team o se migra gradualmente a Postgres autogestionado (Neon / RDS) con réplicas de lectura, Redis delante para sesiones, Cloudflare como CDN. No optimizar antes de tener 10× la demanda actual — la arquitectura se valida con datos reales.

### 2026-04-19 — Tabla de contribuciones única con enum
Diseño sugerido: `contribuciones(id, user_id, tipo enum, seccion_pharos text null, target_id uuid null, creada timestamptz)`. Un solo insert por cualquier acción cívica (video, hilo, respuesta, PEC, pin, espacio recuperado). El agregado de capital se computa con una sola query por usuario, y así podemos re-ejecutar la función `puntosPorContribucion` cuando iteremos sus pesos sin migrar datos.

## Articulación con KOINOS

### 2026-04-19 — Compartir perfil y capital con KOINOS
Prevista la tabla `profiles` replicada. Decisión pendiente: ¿perfil único cross-producto (una sola tabla para KOINOS + OCRE) o perfiles espejo con sync? Favorece lo primero si queremos una sola identidad cívica.

### 2026-04-19 — Digitalizador urbano pixel art → Polis OCRE
El pipeline ya documentado en `KOINOS/POLIS_digitalizador_urbano.md` debe alimentar el mapa de Polis. Material base en `KOINOS/estilos/*.json`.

## Territorio

### 2026-04-19 — Rutas dinámicas por territorio
Pendiente: `/isla/[islaId]`, `/isla/[islaId]/[municipioId]`, `/isla/[islaId]/[municipioId]/[barrioId]`. Cuando exista, convertir los botones del `NavegadorTerritorio` en `<Link>`.

### 2026-04-19 — Barrios reales
Hoy solo hay barrios mapeados para las capitales insulares y algunos municipios grandes. Fuente real: secciones censales del INE + OSM. Cuando conectemos, generar seed SQL.

## Gamificación / Cursus

### 2026-04-19 — Insignias laterales no lineales
Idea: "custodio/a del agua", "guardián/ana de la biblioteca del barrio", etc. Insignias que cruzan el cursus y aportan reconocimiento lateral sin escalar niveles.

### 2026-04-19 — Red profesional a partir del cursus
Cuando haya varios oikonómoi y ergátai por barrio, ofrecer "sugeridos cercanos con PECs relevantes" como motor de enlace profesional dentro del común.

## Taxonomía

### 2026-04-19 — Cuarto eje opcional `oikonomia`
Se decidió reducir a 3 ejes (koinonía/paideía/politeía). Si en iteraciones posteriores aparece una economía local productiva en OCRE, la interfaz `PesoPorEje` admite ampliarla sin romper contribuciones existentes.
