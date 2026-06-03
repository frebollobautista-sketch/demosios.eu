# Plan — Cerrar el registro + vincular participación (OCRE)

> Estado: PLAN (no ejecutado). Redactado 2026-06-03 tras auditar `main`.
> Objetivo del usuario: app en **modo cerrado** (por invitación), donde los
> usuarios registrados crean propuestas y añaden etiquetas en red social y
> deliberación, y su participación (upvotes, votos, guardados, propuestas)
> queda **atada a su perfil** y persiste.

## Veredicto de la auditoría (punto de partida)

- ✅ **Auth real y sólido**: registro/login/recuperación/ajustes RGPD, perfil
  por trigger `handle_new_user`. Migración `20260603001450 auth_perfil_rgpd`
  aplicada.
- ✅ **Deliberación (Ágora) ya atada al usuario**: crear hilo/propuesta,
  comentar, votar (1/usuario, upsert), PEC, tags de hilo. Gating cliente+server+RLS.
- 🔴 **El "cerrado" NO cierra**: sin `middleware.ts`; invitación 100% cosmética
  (nadie consulta `invitations`/`waitlist`, `/registro` abierto); onboarding
  obligatorio no se fuerza.
- 🟠 **Red social mockeada**: `/feed` es playground sin Supabase. `likes`,
  `album_items` sin usar. STOA (`posts`) es la capa real pero sin likes,
  guardados ni tags.
- 🔴 **`contribuciones` nunca se escribe** → capital/cursus/avatar siempre a 0.

Formas de tabla confirmadas (Supabase `ocre`):
- `invitations(code, created_by, used_by, used_at, expires_at, created_at)`
- `waitlist(email, name, created_at)`
- `likes(post_id, user_id, created_at)` — UNIQUE recomendable
- `album_items(user_id, kind, storage_path, caption, source_post_id, …)` → es
  **álbum de medios propio**, NO sirve como bookmark. Para guardados → tabla nueva.
- `contribuciones(user_id, tipo enum, seccion_pharos, target_id, creada)`
- `posts(author_id, text, image_url, video_url, skin, is_ai, ai_label, cita_*)`

---

## FRENTE A — Cerrar el registro (la puerta) · prioridad 1

### A1. Middleware de sesión  `src/middleware.ts` (NUEVO)
- Patrón estándar `@supabase/ssr`: `createServerClient` + `updateSession` que
  refresca cookies en cada request. Hoy falta y `src/lib/supabase/server.ts:21`
  ya **asume** que existe.
- `matcher` excluye estáticos (`_next`, assets, favicon) y rutas públicas.
- En el mismo middleware se centraliza el gating de A3 (onboarding) y, si se
  quiere, el "leer abierto / participar cerrado" (las escrituras ya están
  protegidas en server actions; el middleware es defensa añadida).

### A2. Gating por invitación REAL
**Migración nueva** `xxxxxxxx_invite_gating.sql` (idempotente):
- `redeem_invitation(p_code text)` `SECURITY DEFINER`: bloquea fila
  (`for update`), valida `used_by is null` y `expires_at > now()`, marca
  `used_by = auth.uid()`, `used_at = now()`. Devuelve ok/código de error.
- Validación en el **trigger `handle_new_user`** (atómico y server-enforced):
  leer `raw_user_meta_data->>'invite_code'`; si falta o `redeem_invitation`
  falla → `RAISE EXCEPTION` (el signup se revierte). Set `profiles.invited_by`
  y `profiles.invitation_code`.
- `mis_invitaciones()` (o RLS select `created_by = auth.uid()`).
- `generar_invitaciones(n int)`: crea N códigos para el usuario (límite
  `INVITES_PER_USER`); llamada al completar onboarding o bajo demanda en `/invite`.
- Seed: crear invitaciones para los 2 perfiles existentes / un código maestro
  de arranque, para no autobloquearse.

**Front**:
- `src/app/registro/RegistroForm.tsx`: añadir campo **código de invitación**;
  pasarlo en `signUp(options.data.invite_code)`; mostrar el error en español si
  el trigger lo rechaza (mapear en `src/lib/auth/errores.ts`).
- `src/app/invite/page.tsx`: sustituir `PLACEHOLDER_INVITES` (líneas 31-38) por
  SELECT real de `invitations` del usuario + botón “generar” → `generar_invitaciones`.
- `src/app/waitlist/page.tsx`: INSERT real en `waitlist` (hoy `console.log`,
  línea ~52); `CURRENT_USERS` = count real de `profiles`; **arreglar
  `/register` → `/registro`** (línea ~58); quitar el código hardcodeado
  `KOINOS-ALPHA-2026`.
- Unificar marca **KOINOS → OCRE** en invite/waitlist.

### A3. Forzar onboarding
- En `src/middleware.ts`: si hay sesión y `onboarding_completed = false` y la
  ruta no está en la allowlist (`/onboarding`, `/login`, `/registro`, `/auth/*`,
  `/legal/*`, `/waitlist`, `/invite`) → `redirect('/onboarding')`.
- Para evitar un query por request: meter `onboarding_completed` en el JWT
  (`app_metadata`) vía trigger/hook, o cachear. MVP: query ligero a `profiles`.

**Criterio de aceptación A**: un usuario sin código no puede registrarse; con
código válido sí (y queda `invited_by`); tras registrarse es llevado a
onboarding antes de poder participar; la sesión se refresca en server.

---

## FRENTE B — Participación red social atada al perfil · prioridad 2

> Decisión previa: **STOA (`posts`) es la red social real**; `/feed` (6k líneas
> mock) se jubila o se redirige a STOA. Confirmar con Pancho.

### B1. Upvotes / Likes
- **Migración**: `likes` UNIQUE(`post_id`,`user_id`); RLS (select público,
  insert/delete `user_id = auth.uid()`). Contador: columna denormalizada
  `posts.like_count` + trigger `AFTER INSERT/DELETE ON likes`, o `count()` en lectura.
- **Server action** `toggleLike(postId)` en `src/lib/stoa/` (valida sesión).
- **UI**: botón like en la tarjeta de post de STOA (optimista con reversión,
  como `PanelDecidim`). Hoy STOA no tiene reacciones.

### B2. Guardados / Bookmarks
- **Migración**: tabla nueva `saved_posts(id, user_id, post_id, created_at,
  unique(user_id,post_id))` + RLS own. (NO usar `album_items`, que es álbum de medios.)
- **Server action** `toggleSave(postId)`.
- **UI**: botón guardar en la tarjeta + pestaña “Guardados” en `/perfil`.

### B3. Etiquetas en posts
- **Migración**: `posts.tags text[]` + índice GIN. (Espeja las categorías del
  prototipo iso.)
- **UI**: input de tags en `src/app/stoa/Compose.tsx`; filtro por tag en el listado.

### B4. (Puente diseño→real) Skins/mausoleo en STOA
- `posts` ya tiene `skin, is_ai, ai_label, cita_text/author/source`. Mapear esos
  campos a la tarjeta de STOA reusando el diseño del prototipo iso (galería de
  arte + glosa/chascarrillo etiquetados). Conecta lo prototipado con la app real.

**Criterio de aceptación B**: dar like y guardar persiste atado al usuario y
sobrevive recarga; los posts pueden llevar tags; STOA pinta skins/citas IA.

---

## FRENTE C — Mi actividad / contribuciones · prioridad 3

### C1. Poblar `contribuciones` al participar
- **Migración**: triggers `AFTER INSERT` en `agora_hilos`, `agora_comentarios`,
  `agora_votos_propuesta`, `agora_votos_decision`, `agora_pecs_hilo`, `posts`,
  (y `likes`/`saved_posts` si cuentan) → insert
  `contribuciones(user_id, tipo, seccion_pharos, target_id)`. Mapear el enum `tipo`.
  Fuente única en SQL (robusto frente a olvidar el insert en cada server action).

### C2. Recalcular capital / cursus
- Función `recalcular_capital(p_user uuid)` + trigger tras insertar contribución
  (la migración `…_blap_competencias.sql` ya lo deja como PENDIENTE). Alimenta
  capital, grado y desbloqueos de avatar (`src/lib/avatar/contexto.server.ts`,
  `src/lib/capital/contribuciones.ts`).

### C3. `/perfil` propio agrega actividad real
- `src/app/perfil/page.tsx` hoy solo lee `contribuciones` (vacía). Reusar la
  lógica del perfil público `src/app/perfil/[handle]/page.tsx` (que ya lista
  hilos + posts) para mostrar mi actividad + capital/cursus ya no-cero.

**Criterio de aceptación C**: al crear/votar/postear sube el capital; `/perfil`
propio muestra mi actividad y mi grado real; el avatar desbloquea por uso.

---

## Secuencia recomendada
1. **Frente A** (cierra de verdad — es la petición literal). Empezar por
   `middleware.ts` (desbloquea sesión + onboarding) y el gating de invitación.
2. **Frente C** (poco código, alto impacto: arregla capital/cursus/avatar a 0).
3. **Frente B** (participación social visible: likes, guardados, tags, skins).

## Riesgos / decisiones abiertas
- **Auth Hook vs trigger** para rechazar signups sin invitación (recomendado:
  trigger `handle_new_user`, atómico y sin config de hooks).
- **No autobloquearse**: seed de invitaciones para los perfiles actuales.
- **Jubilar `/feed`** (playground) o redirigir a STOA — confirmar.
- Tras cada migración: correr `get_advisors` (security) para no dejar RLS sueltas.
- Tablas huérfanas (`comments`, `follows`, `post_media`): decidir si entran en
  el alcance o se dejan para más adelante.
