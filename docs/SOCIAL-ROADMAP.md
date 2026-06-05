# POLIS · Roadmap red social cívica

> Capa social que va a montarse encima de la base cívica de POLIS.
> Funcionalidades pendientes, decisiones de producto y notas técnicas.
> Última actualización: 2026-05-13.

## Premisa

POLIS hoy es un visor cívico con barrios, indicadores y agenda planeada.
La siguiente capa es **interacción entre personas**: login, perfiles,
mensajes, conversaciones efímeras. La identidad cívica del usuario se
ancla en su barrio (no en su email). La red social no es un add-on,
es la capa que convierte el visor en plataforma.

## Funcionalidades prioritarias

### 1. Sistema de login

- **Magic link por email** + Google OAuth como mínimo. Sin contraseñas
  clásicas (heredado de la decisión de KOINOS/OCRE en `docs/IDEAS.md`
  2026-04-19).
- Apple OAuth cuando haya app móvil.
- Stack: Supabase Auth (ya configurado en KOINOS).
- Tabla `profiles` con: `id`, `handle`, `nombre_publico`, `barrio_id`,
  `cursus_grado`, `created_at`, `email_verified_at`.
- **Barrio de adscripción**: opcional pero recomendado en onboarding.
  Puede ser de residencia, de origen o "donde está mi gente". El
  usuario lo elige.
- Cuentas verificadas vs anónimas: distinción clara. Las verificadas
  pueden votar/proponer; las anónimas solo leen y comentan.

### 2. Pestaña social / chat

- **Pestaña dedicada** en la navegación principal (alongside POLIS,
  Ágora, Bibliotheka, etc.).
- Dentro: bandeja de mensajes + chats individuales y de barrio.
- **Chat por barrio**: cada barrio tiene su sala. Quien tiene
  adscripción al barrio entra automáticamente. Lectura abierta a
  cualquier verificado.
- **Chat individual 1-a-1**: hilo persistente entre dos usuarios.
- **Chats efímeros**: TTL configurable, default **6h** (per usuario).
  Útil para quedadas, consultas rápidas, conversaciones sin huella.

### 3. Mensajes efímeros — política

- **Default**: persistentes (como cualquier app).
- **Toggle por chat**: el iniciador del chat puede marcar "efímero
  6h" antes de enviar el primer mensaje. Decisión irreversible para
  ese chat (no se puede activar/desactivar a mitad de conversación).
- **Indicador visual claro** en cada chat efímero (icono reloj
  ámbar arriba).
- **Cuenta atrás visible** por mensaje: cada mensaje muestra cuánto
  le queda hasta autoborrarse.
- **Server-side delete**: después de 6h, Supabase función programada
  borra la fila. No hay backup, no hay logs.
- **Caveats legales**: si la conversación incluye delito (amenaza,
  acoso), el TTL no protege de obligación de retención si hay orden
  judicial — comunicar en T&C. Mientras no haya orden, todo se
  borra como prometido.

### 4. Notificaciones

- **Web push**: opt-in obligatorio. Notifications API estándar.
- **Email digest**: resumen diario opt-in con actividad de tu barrio.
- **Frecuencia configurable**: ninguna / al instante / digest.

### 5. Moderación

- **Botón reportar** en cada mensaje + comentario.
- Cola de moderación gestionada por **moderadores de barrio** (rol
  elegido por residentes del barrio cada N meses).
- Apelación al equipo central si el caso lo amerita.
- Logs de moderación públicos (con redacción de nombres).

## Integración con la base cívica

| Capa social | Anclaje a POLIS |
|---|---|
| Login | `profiles.barrio_id` → barrio de identidad/residencia |
| Chat por barrio | `barrios-canonical.json.<barrio_id>` provee el polígono y la lista de usuarios verificados con `barrio_id == <id>` |
| Quedada efímera con localización | El primer mensaje puede marcar una coordenada → aparece como punto vivo en el iso por TTL del chat |
| Hilos públicos de Ágora | Compartibles desde chat 1-a-1 (link) |
| Cursus honorum | Mensajear, quedar, organizar suma puntos al usuario y al barrio |
| Insignias verificadas | "custodio del agua", "guardián biblioteca barrio" — visibles en perfil |

## Decisiones pendientes

- **¿Mensajes efímeros borran o solo ocultan?** Default propuesto:
  borrar duro. Alternativa conservadora: marcar como "expirados",
  retenidos 30d para casos de moderación.
- **¿Chats abiertos por defecto?** Default: solo verificados. Opción
  user: pueden permitir mensajes de anónimos en su perfil.
- **¿Search en historial?** Sin index full-text si efímero. Si
  persistente, opcional con opt-in.
- **¿GDPR derecho al olvido vs comunidad?** Borrado de cuenta = borrado
  de mensajes propios, pero los mensajes en chats donde otros
  participaron pueden conservarse anonimizados (usuario_borrado).
- **¿Acoso entre barrios?** Mecanismo anti-pile-on: un usuario solo
  puede iniciar X chats nuevos por día con desconocidos. Crece con
  cursus honorum.

## Stack técnico esperado

- **Auth + DB**: Supabase Auth + Postgres
- **Realtime chats**: Supabase Realtime (postgres_changes)
- **Ephemeral delete**: pg_cron + función SQL programada
- **Push**: VAPID + Service Worker en frontend
- **Email**: Postmark o Resend (ambos baratos)
- **Migraciones**: ver patrón en `KOINOS/supabase/` ya existente

## Lo que NO se hace en POLIS

- Feed lineal global tipo Twitter/Mastodon → vive en KOINOS (FEED).
- Hilos públicos largos → vive en KOINOS (Ágora).
- Vídeos / streaming → fuera de alcance del proyecto.
- Compras / pagos → fuera de alcance.

## Orden razonable de implementación

1. **Login Supabase Auth** + tabla profiles minimal (~1 día)
2. **Adscripción a barrio en onboarding** + perfil público básico (~0.5 día)
3. **Chat 1-a-1 persistente** (~1.5 días Supabase Realtime + UI básica)
4. **Chat por barrio** (~1 día — sala derivada de profiles.barrio_id)
5. **Mensajes efímeros 6h** + pg_cron de borrado (~1 día)
6. **Notificaciones web push** (~1 día)
7. **Moderación + reportes** (~1.5 días)
8. **Cursus aplicado a interacciones sociales** (~0.5 día)

Total estimado: 7-9 días foco. Asume Supabase Auth ya cableado en
otros productos KOINOS y que la UI base de POLIS está estabilizada.
