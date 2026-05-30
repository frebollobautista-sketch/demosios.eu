# Árbol Mêtis — el sistema de habilidades de OCRE

> Documento de diseño. Propuesta, mayo 2026. Sustituye la escalera lineal de
> [`CURSUS_HONORUM.md`](./CURSUS_HONORUM.md) por un árbol de dos ramas, sin
> tirar nada de lo ya decidido: los 7 grados y sus funciones cívicas siguen
> existiendo, pero ahora se *derivan* del árbol en lugar de alcanzarse por
> umbral de puntos.

## De dónde viene

El Nobel de Economía 2025 (Mokyr; Aghion-Howitt) sostiene que la innovación
se vuelve autosostenida cuando el conocimiento **proposicional** (saber *por
qué* — los *savants*) se encuentra barato y a menudo con el conocimiento
**prescriptivo** (saber *cómo* — los *fabricants*). OCRE quiere lo mismo para
el tejido cívico de un barrio: que quien entiende un problema y quien sabe
ejecutarlo se encuentren.

El árbol de habilidades es la traducción de esa tesis a mecánica de juego.
Tiene dos ramas —**savant** y **fabricant**— y el valor más alto de la
plataforma no está en ninguna de las dos por separado, sino en el **tronco**
donde se cruzan.

Nombre propuesto para el sistema: **Mêtis** (μῆτις), la inteligencia práctica
griega que une el saber y el hacer — el mismo término que James C. Scott usa
en *Seeing Like a State* para el conocimiento situado y local. Marco visual:
el **olivo de Atenea** — Atenea es diosa a la vez de la sabiduría y de los
oficios, y *Los dones de Atenea* es, literalmente, el título del libro de
Mokyr. (Nombre abierto a revisión.)

## Las dos ramas

| Rama | Griego | Es | Capital que la alimenta | Pregunta |
|---|---|---|---|---|
| **Epistḗmē** | ἐπιστήμη | la rama *savant* | Paideía (principal) + Koinonía | ¿Por qué? |
| **Téchnē** | τέχνη | la rama *fabricant* | Politeía (principal) + Koinonía | ¿Cómo? |

`Epistḗmē` reúne los nodos de entender, diagnosticar, documentar y enseñar.
`Téchnē` reúne los nodos de organizar, mapear, coordinar y ejecutar.

La distinción `epistḗmē` / `téchnē` es la frontera clásica griega (Aristóteles)
entre el conocimiento teórico y el oficio. Encaja exactamente sobre la pareja
proposicional / prescriptivo de Mokyr y sobre savant / fabricant, y mantiene
el léxico grecolatino de OCRE.

### El tronco — Synousía

Entre las dos ramas, a cada altura, hay nodos puente: **Synousía** (συνουσία,
«estar juntos, asociación»). Un nodo Synousía **no se puede desbloquear desde
una sola rama**: exige tener encendido al menos un nodo `Epistḗmē` y uno
`Téchnē` del mismo tier. Es la representación, dentro del árbol, del encuentro
savant↔fabricant — y el enganche con el motor de emparejamiento del mismo
nombre descrito en `IDEAS.md`.

Un nodo Synousía se puede encender de dos maneras:

- **En solitario** — si una persona ha recorrido las dos ramas ella misma.
- **En pareja** — un savant y un fabricant lo **co-activan**. Cuando se
  co-activa, el coste de práxis (ver abajo) se reparte entre los dos. Emparejarse
  literalmente abarata el nodo más valioso del árbol. Esa es la regla que
  convierte la progresión en un acto de tejido cívico y no en un grind solitario.

## Cómo se conjuga con los tres capitales

OCRE ya tiene los tres capitales en [`src/lib/capital/ejes.ts`](../src/lib/capital/ejes.ts):

| Capital | Eje | Qué lo genera (definición del proyecto) |
|---|---|---|
| **Capital social** | Koinonía | Interacciones cotidianas que generan tejido (PEC, respuestas, presencia). |
| **Capital cultural** | Paideía | Educación y formación (vídeos, recursos, currículos). |
| **Capital político** | Politeía | Lo que se consigue en la app: movilización, grassroots, espacios recuperados. |

El árbol **no cambia cómo se ganan**. Cambia para qué sirven: dejan de ser un
marcador y pasan a ser la llave del árbol, mediante una **mecánica híbrida**.

### Mecánica híbrida: umbral acumulado + práxis renovable

Cada nodo del árbol pide **dos cosas a la vez**:

1. **Umbral de capital acumulado** — un mínimo por eje. El capital acumulado es
   de por vida, **nunca baja**. Es la prueba de que tienes el recorrido cívico
   para merecer ese nodo. Es exactamente la lógica de `requisito` que hoy tienen
   los grados del cursus, pero ahora por nodo.

2. **Coste de práxis** — la **práxis** (πρᾶξις, la acción) es un recurso
   renovable que **sí se gasta** al encender un nodo. Representa la dedicación
   finita que una persona puede comprometer en un ciclo. Se recarga cada semana
   con una dotación base, y las **interacciones cotidianas** (dar un PEC,
   responder en el Ágora, presencia) la rellenan poco a poco hasta un tope. Así,
   el capital social no solo desbloquea: literalmente *recarga la capacidad de
   actuar*.

«Conjugar» significa que **ningún nodo se enciende con un solo capital**: todo
nodo de rama exige su capital principal *y* un mínimo de Koinonía; todo nodo
Synousía exige los tres. El sistema premia al ciudadano redondo, no al que
optimiza una sola métrica.

### Ejemplo de coste de un nodo

```
Nodo «Diagnóstico de barrio»  ·  rama Epistḗmē  ·  tier 2
  umbral   { paideia: 60, koinonia: 20 }   ← acumulado, no se gasta
  praxis   8                                ← se gasta al activar
  abre     anotar capas de datos en POLIS, publicar análisis en Bibliotheka
```

## El árbol absorbe el cursus honorum

Decisión tomada con el usuario (mayo 2026): **el árbol sustituye la escalera
lineal de 7 grados**. Los 7 nombres no desaparecen — se *derivan*.

- **El grado (nivel)** ya no se alcanza por umbral de puntos: se calcula a
  partir de los **puntos de árbol** acumulados (cada nodo encendido vale según
  su tier). Sigue siendo una escalera única y compartida de 7 nombres, de
  Polítes a Árchon, porque el nombre es patrimonio del proyecto.
- **La clase** —lo que el banner flotante ya muestra al lado del nivel— deja de
  ser el «eje dominante» y pasa a ser la **rama dominante**: *savant* si pesas
  hacia Epistḗmē, *fabricant* si pesas hacia Téchnē, **sinérgeta** si tu peso
  está en el tronco Synousía.

Así, dos personas pueden ser ambas `Bouleutés` (mismo nivel) y ser
reconociblemente distintas: una *savant*, otra *fabricant*. El nivel dice
*cuánto* árbol; la clase dice *qué lado*.

| Grado | Se deriva de | Notas que se conservan de `CURSUS_HONORUM.md` |
|---|---|---|
| Polítes | Raíz (registro) | Acceso básico. |
| Oikonómos | ≥ 2 nodos de tier 1 encendidos | Primer oficio: publica en Koiná. |
| Ergátes | Profundidad 2 en alguna rama | Abre serie / modera su sección. |
| Didáskalos | Profundidad 3 + peso en Epistḗmē | Fija hilo, propone currículos. |
| Bouleutés | Profundidad 3 + ≥ 1 nodo Synousía | Propone en Polis, convoca votaciones. |
| Strategós | Profundidad 4 + ≥ 2 Synousía + 1 espacio recuperado | Lidera recuperación de bloques. |
| Árchon | Elegible: profundidad 5 en ambas ramas + Synousía | **Electo y rotatorio anual** — la elección sigue siendo el requisito real. |

El grado **nunca regresa**: aunque un nodo entre en latencia (ver variante
abajo), los puntos de árbol que ya contaron para subir de grado se conservan.

## Mapa de nodos (primera propuesta)

Cinco tiers de profundidad. Cada nodo abre una **capacidad real** de la
plataforma — nunca «solo más puntos», siguiendo el principio 3 del cursus.

### Rama Epistḗmē — savant

| Tier | Nodo | Abre |
|---|---|---|
| 1 | Lectura del común | Leer capas de datos de POLIS, seguir hilos con contexto. |
| 1 | Aprendiz | Completar itinerarios de Bibliotheka; marcar recursos leídos. |
| 2 | Diagnóstico de barrio | Anotar capas de datos en POLIS; publicar análisis. |
| 2 | Memoria | Documentar patrimonio de un bloque; crear ficha patrimonial. |
| 3 | Didáctica | Abrir serie propia en el Cursus de vídeo; proponer currículo. |
| 3 | Contraste | Revisar y contestar el saber de otros (peer review cívico). |
| 4 | Cátedra | Sostener una disciplina; fijar hilo de referencia en Ágora. |
| 5 | Episteme del común | Síntesis territorial; formar a otros savants. |

### Rama Téchnē — fabricant

| Tier | Nodo | Abre |
|---|---|---|
| 1 | Manos | Marcar pines en POLIS; reportar desperfectos al mapa común. |
| 1 | Oficio | Registrar un servicio o recurso verificado en Koiná. |
| 2 | Convocatoria | Organizar quedadas y talleres de barrio. |
| 2 | Cartografía | Liderar misiones de mapeo en POLIS. |
| 3 | Coordinación | Dirigir una cuadrilla / cooperativa pequeña de varios oikonómoi. |
| 3 | Movilización | Convocar votaciones de barrio; recoger apoyos. |
| 4 | Campaña | Abrir un proceso formal de recuperación de bloque. |
| 5 | Téchne del común | Sostener una intervención a escala municipio. |

### Tronco Synousía — el cruce

| Tier puente | Nodo | Exige | Abre |
|---|---|---|---|
| 2 | Encuentro | 1 nodo Epistḗmē T2 + 1 Téchnē T2 | Abrir una ficha de **proyecto** (un diagnóstico + unas manos). |
| 3 | Prototipo | 1 nodo de cada rama T3 | Convertir un diagnóstico en una intervención piloto. |
| 4 | Mandato | 1 nodo de cada rama T4 | Una deliberación del Ágora que se ejecuta y se mide. |
| 5 | Institución del común | 1 nodo de cada rama T5 | Un proyecto que se vuelve permanente (cooperativa, equipamiento). |

## Decisiones de diseño

1. **El árbol absorbe el cursus, pero conserva sus 7 nombres.** El proyecto es
   muy cuidadoso con su léxico; reescribir los grados sería destructivo. El
   nivel se *deriva*; los nombres y las funciones cívicas siguen intactos.
2. **Dos lecturas, no una.** Nivel = cuánto árbol (escalera compartida). Clase =
   qué rama (savant / fabricant / sinérgeta). El banner flotante ya muestra
   «nivel + clase + puntos»: solo cambia el significado de «clase».
3. **Híbrido a propósito.** El capital acumulado no se gasta —el mérito cívico
   no se consume— pero la **práxis** sí, porque la dedicación es finita. Separar
   ambos evita tanto que el capital se devalúe como que el árbol se desbloquee
   de golpe.
4. **El nodo más valioso es cooperativo.** Synousía no se alcanza desde una
   rama. Co-activarlo reparte el coste de práxis: el sistema hace *más barato*
   lo que hace *más tejido*. Es la regla anti-grind y pro-encuentro.
5. **Cada nodo abre una capacidad real.** Igual que las funciones cívicas del
   cursus, ningún nodo es decorativo: desbloquea una acción concreta de OCRE.
6. **Árchon sigue siendo electo.** El árbol da *elegibilidad* (profundidad 5 en
   ambas ramas); el cargo se gana por elección anual y es revocable. El árbol
   nunca debe convertirse en una escalera de poder acumulado.

### Variante abierta — latencia

Para honrar el principio «no premiar cantidad sino persistencia»
([`contribuciones.ts`](../src/lib/capital/contribuciones.ts)): un nodo sin uso
durante N meses entra en **latencia** —se ve atenuado y deja de contar para tu
*clase* visible—, pero **nunca** se apaga ni hace bajar de grado. Mantiene
honesto el «build» actual sin castigar el recorrido. Pendiente de decidir.

## Enganches con el código actual

- `src/lib/capital/ejes.ts` — los tres ejes no cambian; pasan a leerse como
  *umbral* de nodos.
- `src/lib/capital/contribuciones.ts` — además de sumar capital, cada
  contribución cotidiana recargaría **práxis** (campo y función nuevos).
- `src/lib/cursus/grados.ts` — `gradoActual()` deja de mirar `PesoPorEje` y pasa
  a derivar el grado de los puntos de árbol; el tipo `Grado` y los 7 nombres se
  conservan.
- Nuevo `src/lib/metis/` — `nodos.ts` (catálogo del árbol), `arbol.ts` (estado
  del ciudadano, cálculo de grado y clase, práxis).

## Próximos pasos

1. Validar nombres (Mêtis, Epistḗmē, Téchnē, Synousía, práxis) con el usuario.
2. Cerrar el catálogo de nodos y sus costes exactos (umbral + práxis).
3. Decidir la regla de recarga de práxis (dotación semanal + tope por cotidiano).
4. Decidir la variante de latencia.
5. Esqueleto TypeScript en `src/lib/metis/` e integración con `grados.ts`.
