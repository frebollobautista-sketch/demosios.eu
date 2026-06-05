# Protocolo admin — POLIS iso

> Decisión arquitectural sobre privacidad y moderación. Define dos
> capas de visibilidad sobre el mismo dato: **cuantitativo público
> anónimo** (defecto) y **nominal de moderación** (admin only). Este
> doc rige el sistema de gestos cívicos (gestos.js) y cómo se exponen
> sus datos.

## Principio rector

> "Los likes anónimos públicos. Un admin puede entrar al nivel de
> registro donde las medidas cuantitativas ganan nombre."

El sistema almacena, para cada gesto, un identificador anónimo estable
(`userId` generado al primer uso del navegador). Ese `userId`:

- **NO aparece en ninguna UI cara al público**.
- **NO se expone** vía la API pública (`getSenalesAggregadas`,
  `getReportesCount`).
- **SÍ es accesible** a admins autenticados vía
  `getRegistroDetallado()` para legitimación de moderación.

## Dos capas de visibilidad

### Capa pública (anónima, agregada)

Funciones expuestas a todo usuario:

```js
getSenalesAggregadas(ambitoId, zona)  → { pos, neg }
getReportesCount(ambitoId, zona)      → number
getAllGestos()                         → gestos con userId pero sólo
                                         para inspección local del
                                         propio dispositivo
```

La UI pública (`dashboard.js`) solo muestra contadores agregados:
`✓ 12  ✗ 3  ·  5 reportes`. Nunca "Pancho dijo X".

### Capa admin (nominal, individual)

Funciones disponibles solo si `isAdmin() === true`:

```js
getRegistroDetallado(filtros?)  → array de gestos con userId completo
marcarFalso(gestoTs, motivo)    → añade {falso:true, motivo, admin}
amonestar(uid, motivo)          → añade entrada a polis-amonestaciones
listarAmonestaciones()          → historial de amonestaciones del UID
```

El admin ve **quién** (vía `userId` anónimo) dio cada señal o reporte.
NO ve nombre real ni email del usuario en gestos anónimos — el `userId`
es un pseudónimo estable. **El admin solo puede vincular `userId` a una
persona si esa persona ha dejado su email voluntariamente en un
compromiso o registro de entidad** (capa identificada).

## Activación del modo admin

### Fase actual (frontend puro, sin backend)

Mecanismo temporal de activación local — documentado como provisional:

1. Pulsar `Cmd/Ctrl + Shift + A` abre prompt de passphrase.
2. Passphrase correcta → `localStorage.polis-admin-mode = 'true'`.
3. La UI admin (panel "Registro detallado") aparece arriba.
4. `Cmd/Ctrl + Shift + A` con admin ya activo → cierra el modo.

La passphrase actual está hardcoded en `gestos.js` (`ADMIN_SECRET`).
**Esta no es seguridad real** — solo evita que un usuario casual acceda
al modo. En frontend puro cualquiera puede inspeccionar el código o
poner directamente `localStorage.setItem('polis-admin-mode','true')`.

### Fase con backend (objetivo)

Cuando esté Supabase + auth:

1. El usuario autenticado tiene un campo `role` (`citizen` | `admin` |
   `moderator`) en la tabla `users`.
2. Las funciones admin pasan a llamadas a backend con JWT.
3. Row-Level Security (RLS) en Supabase deniega cualquier intento de
   leer `userId` desde el rol `citizen`.
4. El frontend simplemente lee `session.user.role` y muestra UI admin
   condicionalmente — la verdadera autorización queda en backend.

La migración es **transparente para los gestos ya recogidos**: el `userId`
local se sincroniza con un `auth.uid` cuando el usuario hace login (o
queda como anónimo perpetuo si no quiere identificarse). La tabla
`gestos` mantiene la separación entre "anonymous_uid" y "auth_uid".

## Compatibilidad legal (GDPR)

- **`userId` no es PII por sí mismo**: es un pseudónimo generado
  client-side. No se puede vincular a una identidad real sin pasos
  adicionales (cruzar con un email voluntariamente entregado).
- **Procesamiento de datos nominales por admin**: legitimación
  "interés legítimo" (mantener calidad del tablero contra falsedad).
  Los admins firman un acuerdo de uso (Confidentiality + propósito
  limitado a moderación).
- **Derecho de borrado**: un usuario puede pedir borrado de sus gestos
  vía email (el sistema busca por `auth_uid` o por hash conocido).
- **Anonimato real para señales/reportes**: cuando el usuario nunca
  ha dejado email, no hay manera de vincular su `userId` a una
  persona física. La moderación queda en el nivel del pseudónimo.

## Acciones admin disponibles

### Marcar gesto como falso

```js
marcarFalso(gestoTs, motivo)
```

Añade `{ falso: true, motivo, marcado_por_admin, marcado_ts }` al
gesto. El gesto NO se borra (auditoría); las funciones de conteo
público filtran los marcados como falsos (no contribuyen a la métrica).

### Amonestar a un userId

```js
amonestar(uid, motivo)
```

Añade entrada a `polis-amonestaciones[]`:
```js
{ uid, motivo, admin, ts }
```

El usuario amonestado NO recibe notificación en frontend puro (es un
log para admins). Con backend, la siguiente vez que envíe un gesto el
sistema le mostraría el aviso.

Las amonestaciones **escalonan**: 1ª = advertencia, 2ª = throttle,
3ª = ban temporal del UID (lo cual el usuario puede sortear vaciando
localStorage — esperado, es solo para usuarios casuales no
adversariales).

## Rotación de admins

Cuando llegue el backend:
- Admins iniciales: Pancho + lista corta definida.
- Decisiones colectivas vía cabildo abierto cada N meses para añadir
  o retirar admins.
- Acciones admin son log inmutable: `polis-admin-log[]` con qué admin
  hizo qué cuándo.

Mientras no haya backend: solo un admin (el desarrollador). Toda
acción queda en localStorage del navegador del admin.

## NO hacemos

- Doxxear usuarios públicamente, ni siquiera tras amonestación.
- Vincular `userId` a perfiles sociales, IP, fingerprinting, etc.
- Mostrar al público "los reportes vienen sospechosamente del mismo
  UID" — eso es trabajo interno del admin.
- Vender, ceder o exportar el registro nominal a terceros.

## Migración a backend (checklist)

- [ ] Tabla `gestos(id, anonymous_uid, auth_uid?, tipo, payload, zona, ts)`
- [ ] RLS: SELECT público solo expone agregados; SELECT nominal sólo
      a `role = admin`
- [ ] Función `mark_false(gesto_id, motivo)` con `SECURITY DEFINER`
- [ ] Tabla `amonestaciones(uid, motivo, admin_id, ts)`
- [ ] Frontend reemplaza `isAdmin()` por `session.user.role === 'admin'`
- [ ] Sync `polis-gestos[]` local → tabla backend al primer login del
      usuario (o queda como `anonymous_uid` perpetuo)

— Pancho, mayo 2026
