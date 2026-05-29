# POLIS · Interacciones de agenda

> Lista exploratoria de interacciones para convertir POLIS en una agenda
> cultural / social / cívica vinculada al territorio. Heredera de la idea
> original de FEED y TOUCH: si **FEED** es flujo público lineal y **TOUCH**
> es conversación íntima entre pocos, la **agenda** es el plano espacial
> de todo lo anterior — eventos, encuentros y memoria proyectados sobre
> el mapa de barrios.
>
> Este doc NO es plan de implementación. Es banco de ideas para iterar
> cuando llegue el momento de pasar del visor cívico al activador cívico.
> Última actualización: 2026-05-11.

## Premisa

El mapa POLIS de barrios ya identifica unidades reconocibles (Vegueta, La
Isleta, Tarahales, etc.). La agenda **anima esas unidades en el tiempo**:
cada barrio tiene cosas que pasan ahora, han pasado, van a pasar. La
interacción base no es "ver un mapa" sino "ver mi barrio vivo".

Articulación con lo existente:

- **FEED** (público, lineal) — los eventos publicados aparecen también en
  el feed cronológico tradicional. Quien no quiera mapa sigue teniendo
  timeline.
- **TOUCH** (privado, conversacional) — las quedadas, asambleas pequeñas,
  encuentros que nacen de un hilo privado pueden "materializarse" como
  evento mapa si los participantes consienten.
- **Cursus honorum** — la asistencia / organización / consolidación de
  eventos suma puntos de capital cívico al usuario y al barrio.
- **Ágora** — los hilos públicos abiertos sobre un barrio aparecen como
  capas sobre el mismo plano.

## Catálogo de interacciones

### 1. Eventos puntuales en el territorio

**Qué**: cualquier usuario crea un evento (cultural, asambleario,
comercial, lúdico) con coordenadas dentro de un barrio. Aparece como
marcador temporal en el mapa.

**Interacciones**:
- Tap en marcador → expand card (título, fecha, lugar concreto, organizador, asistentes confirmados)
- Botón "voy" → suma a tu agenda personal + cuenta en asistentes
- Botón "compartir" → genera link de Ágora si quieres convertirlo en hilo público
- Botón "ruta" → calcula camino desde tu ubicación o desde el lugar que decidas

**Tipologías mínimas a soportar**:
- Cultural: concierto, exposición, presentación, cineforum
- Asambleario: junta vecinal, comisión, reunión de coro
- Comercial / mercado: feria, rastrillo, intercambio
- Lúdico / abierto: quedada para correr, partido, picnic
- Conmemorativo: efeméride local, ofrenda, romería

### 2. Cronología viva del barrio

**Qué**: cuando entras a un barrio, **bajo el iso aparece una franja de
tiempo** (timeline horizontal) con eventos pasados (apagados),
presentes (encendidos), futuros (parpadeantes).

**Interacciones**:
- Scroll horizontal → recorres pasado-futuro del barrio
- Tap en un evento del pasado → memoria, fotos, hilos que se abrieron en su día
- Tap en un evento futuro → mismo expand card que (1)
- Filter chips arriba: "cultural", "asamblea", "comercio", "lúdico", "memoria"

**Modo memoria**: si arrastras el timeline meses atrás, el iso del barrio
se "enfría" visualmente (paleta sepia) — el barrio se ve "como entonces"
con los edificios que existían (cuando tengamos datos catastrales con
fecha) y los eventos que ocurrieron. Aunque solo sea simbólico.

### 3. Agenda personal del usuario

**Qué**: panel propio que acumula eventos a los que dijiste "voy". Vista
mapa (puntos en barrios) + lista cronológica.

**Interacciones**:
- "Mis eventos" filtra solo lo tuyo
- "Mi semana" muestra próximos 7 días en cualquier barrio
- "Mi barrio" filtra a tu barrio de adscripción
- Drag-drop eventos a un calendario externo (.ics export)
- Notification opt-in por evento o por barrio

### 4. Quedadas espontáneas

**Qué**: usuario en TOUCH con 2-5 personas decide algo informal ("nos
vemos en la plaza en 20 min"). Si el grupo lo consiente, la quedada
**aparece como punto vivo en el barrio durante X horas** y otros usuarios
del barrio pueden sumarse.

**Interacciones**:
- Crear desde TOUCH con un toggle "hacer visible"
- TTL default 4h (configurable)
- Lista de asistentes solo visible a participantes confirmados
- "Sumarse" envía solicitud, el grupo original aprueba
- Cuando la quedada termina, queda como punto histórico en la cronología
  del barrio (sin nombres, solo "hubo quedada de 7 personas")

### 5. Cursus honorum aplicado a eventos

**Qué**: la agenda alimenta la gamificación del proyecto.

**Mecánicas**:
- Asistir a un evento (verificado por geolocalización opcional o por
  confirmación cruzada) = puntos al usuario y al barrio
- Organizar un evento que cumpla mínimos de asistencia = puntos
  superiores
- Consolidar tradición (3+ ediciones del mismo evento, intervalo
  regular) = un evento se asciende a "patrimonio cívico vivo" del barrio
- "Padrino" / "madrina" de un evento recurrente = rol cívico con insignia
- Eventos imposibles de organizar solo (asambleas de 30+ personas,
  intercambios materiales >50 ítems) = palancan capital colectivo del
  barrio, no individual

### 6. Coros cívicos (agrupaciones temáticas)

**Qué**: usuarios con interés común forman un coro (yoga del Parque
Romano, biblioteca pop-up de La Isleta, defensa del solar de Schamann).
Cada coro **tiene su propia mini-agenda** dentro del barrio.

**Interacciones**:
- Crear coro: nombre + categoría + barrio + descripción + intervalo (semanal, mensual, esporádico)
- Suscribirse → ves su agenda en tu vista personal
- El coro acumula puntos de barrio igual que eventos sueltos
- Coros que llevan >6 meses sin actividad entran en "estado durmiente"
  pero la página queda — herencia, no eliminación

### 7. Mercado local y derrama económica

**Qué**: comercios y comerciantes (legítimamente registrados o no — el
sistema lo trata por igual al principio) publican su agenda: horarios,
ofertas del día, productos de temporada. Geolocalizado al barrio donde
operan.

**Interacciones**:
- Tap en un edificio iso → si tiene comercio, expand card con horario y agenda
- Filtro "abierto ahora" en la vista del barrio
- "Producto del día" como marcador efímero
- Conexión con la métrica de "cuánto se queda en el territorio" (paralelo a
  la idea de cruceros del 2026-05-11 en docs/IDEAS.md): cada compra
  declarada suma al indicador de derrama del barrio

### 8. Memoria activa

**Qué**: efemérides, datos históricos, lugares marcados con significado
("aquí estuvo el cine X", "aquí pasó la huelga del 73"). Capa
permanente sobre el iso, activable.

**Interacciones**:
- Tap en un punto memoria → texto + foto histórica + hilo Ágora asociado
  (donde la gente añade su propio recuerdo)
- Vista "este día en mi barrio" — la cronología filtrada a las
  efemérides que tocan hoy
- Modo "ruta de la memoria" — concatena 3-7 puntos memoria del barrio en
  un orden caminable, con audioguía opcional

### 9. Encuentros transversales (inter-barrios)

**Qué**: eventos que ocurren a caballo entre dos barrios o organizados
por dos barrios distintos. Esenciales para la mecánica de "competición
amistosa que reactiva colectivismo" — la competición es entre barrios,
pero la cooperación también.

**Interacciones**:
- Botón "co-organizar" al crear evento → invita a usuarios de otro
  barrio
- El evento puntúa para ambos barrios (50/50 por defecto, ajustable)
- "Alianzas" permanentes entre barrios adyacentes: dos barrios pueden
  declararse aliados y reciben bonificación cuando organizan juntos

### 10. Indicadores cívicos como filtros

**Qué**: la agenda no vive aislada — está superpuesta a las capas
cívicas ya portadas (renta, vacacionales, guaguas, educación...). Un
evento "asamblea sobre el aumento de vivienda vacacional en Las
Canteras" cobra sentido cuando ves debajo el mapa de VV de ese barrio.

**Interacciones**:
- Al crear un evento, sugerir tag de "indicador relacionado" (vivienda,
  educación, movilidad, salud, espacios verdes...) — opcional
- En la vista del barrio, los eventos pueden filtrarse por indicador
- Coropleta de fondo: al activar "renta" la agenda sigue visible pero
  los marcadores cambian de color para contrastar (no para enseñar
  algo distinto — para legibilidad)

## Pendientes conceptuales

- **¿Quién puede crear evento?** Cuenta verificada / suscriptora /
  cualquiera. Coste de añadir fricción vs evitar spam.
- **¿Moderación de barrio?** ¿Hay rol "vigía" elegido por residentes
  del barrio que arbitra incidencias? ¿Apoyo de Ágora?
- **Privacidad de asistencia**: por defecto un evento muestra cuántos van, no
  quiénes. Listas visibles solo a participantes.
- **Eventos pasados borrables vs perennes**: tras N años, ¿se compactan
  a "memoria del barrio" o se conservan completos?
- **Integración con calendarios externos**: ICS export es trivial; sync
  bidireccional con Google/Apple calendars probablemente no merece la
  pena al inicio.
- **Geolocalización opcional**: no obligar a compartir ubicación para
  asistir o participar — la asistencia se confirma cruzando, no
  rastreando.

## Anclajes con el resto del proyecto

| Concepto agenda | Donde vive en POLIS hoy |
|---|---|
| Eventos en barrio | `polis-app/` overlays/eventos.js (a crear, schema `events.geojson` por barrio) |
| Cronología | UI nueva, no existe — sería componente bajo el canvas iso |
| Agenda personal | depende de auth (Supabase) — tabla `user_events` |
| Quedadas TOUCH→mapa | bridge entre `src/app/touch/` y POLIS — pendiente diseño |
| Puntos cursus por evento | extiende `contribuciones` enum (ver `IDEAS.md`) |
| Coros | tabla `coros` nueva en Supabase, asociada a barrio |
| Mercado | tabla `comercios` + `comercio_eventos`, geolocalizadas |
| Memoria | overlay `memoria.js` con datos curados + contribuciones de usuarios |
| Inter-barrios | tabla `eventos_co_organizado` (m2m con barrios) |

## Orden razonable para empezar (cuando llegue el momento)

1. **Crear evento + lista plana en barrio** (interacción 1, sin más). Es
   el bloque de construcción. Sin nada más, ya es útil.
2. **Agenda personal** (interacción 3) — convierte la herramienta en
   personal, no solo público.
3. **Cronología visual** (interacción 2) — el "ver el barrio vivir" que
   diferencia POLIS de una agenda lineal cualquiera.
4. **Cursus aplicado a eventos** (interacción 5) — atrae a quien
   construye, no solo a quien consume.
5. **Coros + mercado + memoria** (6, 7, 8) — capas ricas que se montan
   sobre lo anterior.
6. **Quedadas TOUCH→mapa, inter-barrios, filtros por indicador** (4, 9,
   10) — refinamiento.
