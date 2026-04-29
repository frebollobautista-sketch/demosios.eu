# Método NODOS — patrimonio metodológico para KOINOS

> Distilación del marco metodológico de Nodos Culturales (Lima, 2021-2026), recogida como **patrimonio institucional del ecosistema KOINOS** independientemente de que se implemente o no en Demos iOS. Sirve de referencia para cualquier intervención cívico-cartográfica que el proyecto encare en el futuro.

Fuentes primarias: el expediente del usuario en `NODOS/Nodos v0.1/` y `Nodos v0.2/`, la web pública de Nodos Culturales (`/que-es-un-mapeo-colectivo/`, `/metodologia-mapeo-lima/`, `/programa-de-mapeos-comunitarios/`, `/a-que-llamamos-espacios-culturales/`, `/que-nos-dice-el-mapeo-sobre-los-enfoques-movilizadores/`, `/comas/`) y el paper SciELO 2023 de la propia organización.

Última revisión: 2026-04-29.

---

## 0. Por qué se guarda esto

NODOS no llega a la cartografía digital desde el GIS ni desde el design thinking. Llega desde **trabajo sociológico de campo**: 5 años de talleres con vecinos, colectivos y gestores culturales en Lima Norte, Sur, Este, Centro y Comas, alimentando una serie de cartografías que se publican como Google My Maps con cientos de miles de visitas. El método nace del campo, no de la pizarra.

Para KOINOS — proyecto que articula Demos iOS (cívico) y los módulos sociales (FEED, TOUCH) en torno a una misma plataforma del común — esto es relevante por tres razones acumulables:

1. **Extiende nuestra capacidad de modelar realidad cívica viva** más allá del bloque catastral.
2. **Trae lecciones operativas** sobre cómo se conduce un mapeo participativo sin caer en directorio frío.
3. **Cita literatura comparable** que sostiene también el OCRE (cartografía crítica + epistemologías del Sur + pedagogía dialógica), reforzando el marco teórico que ya teníamos por intuición.

---

## 1. La tesis: mapear es un acto político

Según Nodos, el mapeo colectivo no es la confección de un inventario sino una **práctica política de producción de conocimiento desde la ciudadanía** que cuestiona la representación dominante del territorio. La cita textual de su `/que-es-un-mapeo-colectivo/`:

> "El mapeo es una herramienta crítica que permite cuestionar las representaciones hegemónicas del espacio, visibilizar saberes invisibilizados y reconfigurar el sentido de pertenencia."

Esto tiene **dos consecuencias duras** para cualquier plataforma que pretenda operar este tipo de mapeo:

- **El modelo de datos no puede reducirse a "puntos con coordenadas"**. Tiene que admitir entidades sin coordenada fija (prácticas itinerantes, agentes culturales).
- **La provenance importa tanto como el dato**: quién mapeó, en qué taller, con qué método. El backend debe registrar esa trazabilidad.

---

## 2. Dos tipos de cartografía que NODOS practica

NODOS distingue claramente entre dos escalas de trabajo:

| Escala | Cartografías Culturales (ciudad) | Cartografías Comunitarias (territorio acotado) |
|---|---|---|
| Foco | Espacios culturales | Ecosistema cultural completo |
| Objetos mapeados | Espacios | Espacios + agentes + prácticas + símbolos + memorias |
| Resultado típico | Cartografía con muchos puntos | Cartografía + relatos + redes |
| Ejemplos | Cartografía Cultural de Lima Centro 2021 | Comas 2026, Lima Norte 2025 |

La **comunitaria es la más rica metodológicamente** y es donde la sociología aflora. La cultural a nivel ciudad es la que alimenta el inventario público que luego se publica.

**Equivalencia con KOINOS**: Polis hoy vive a escala "cultural" (panorámica de capital). Los "comunitarios" — los talleres por barrio, las relaciones vivas dentro de un Vegueta, una San Cristóbal o un Jinámar — son una capa que aún no tenemos formalizada y donde NODOS tiene mucho que enseñar.

---

## 3. Tres ontologías mapeables

El descubrimiento más fuerte de su trabajo de campo es que un mapeo cultural rico necesita **tres tipos de objeto distintos**, no uno. Hoy en día Polis solo modela el primero; los otros dos hay que tenerlos en mente:

### 3.1 Espacios — lugares con coordenada fija

Lo que llamaríamos en Polis `bloque` o `equipamiento`. Tienen latitud y longitud, persistencia y propiedades estables (tipo, gestión, manifestaciones).

### 3.2 Agentes — personas, colectivos, organizaciones

Sostenedores de prácticas culturales. **No tienen coordenada propia**: se vinculan a uno o más espacios, o a un territorio. Schema canónico de NODOS (sintetizado de su `04_metodologia_categorias_nodos.md`):

```jsonc
{
  "id": "yuyachkani-grupo",
  "nombre": "Grupo Cultural Yuyachkani",
  "tipo": "colectivo",                  // artista_individual | colectivo | organización | institución | gestor
  "rol": ["creador", "formador"],       // creador | gestor | mediador | docente | curador | activista
  "manifestaciones": ["performativa", "literaria"],
  "espacios_vinculados": ["yuyachkani"],
  "alcance_territorial": "lima-metropolitana",
  "fundacion": 1971,
  "url_externa": "https://yuyachkani.org",
  "proyecto_cartografico": "lima-centro-2024",
  "metodo_captura": "presencial"
}
```

**Equivalencia KOINOS**: hoy nuestro `profiles` mezcla individuos con cualquier identidad. Distinguir agentes-colectivos como entidad propia (cooperativas, asociaciones vecinales, colectivos artísticos, AMPAs) sería un avance. No son usuarios autenticados; son entidades cívicas que se mapean.

### 3.3 Prácticas — eventos, rituales, dinámicas

Aquí está la pieza más distintiva. Las prácticas pueden ser:

- **Recurrentes con punto fijo** (peñas semanales en una sala concreta).
- **Recurrentes y móviles** (yunzas, polladas — mismo barrio, distinto cruce de calles cada año).
- **Ocasionales y geolocalizadas** (un festival concreto en un sitio concreto).
- **Performativas e itinerantes** (pasacalles, intervenciones).

Schema de NODOS:

```jsonc
{
  "id": "yunza-comas-2026",
  "nombre": "Yunzas en Comas",
  "tipo_practica": "ritual_festivo",     // ritual_festivo | feria | festival | pasacalle | taller_recurrente | tertulia | otro
  "manifestaciones": ["performativa"],
  "frecuencia": "anual",                 // anual | mensual | semanal | ocasional | irregular
  "ubicacion_tipo": "movil_barrio",      // fija | movil_barrio | movil_distrito | itinerante
  "puntos": [                            // múltiples puntos posibles, con o sin date
    {"lat": -11.95, "lon": -77.05, "fecha": "2026-02-14", "evento": "Yunza Av. Sangarará"}
  ],
  "agentes_organizadores": ["junta-vecinal-x"],
  "espacio_principal": null,             // o ID de espacio si la práctica tiene base
  "estacionalidad": ["febrero", "carnavales"],
  "proyecto_cartografico": "comas-2026"
}
```

**Equivalencia KOINOS**: las prácticas en Canarias serían asambleas vecinales, mercados de productores, romerías, fiestas patronales, jornadas de limpieza de costa, encuentros de barrio, talleres comunitarios. Son **lo que une el común a la calle**. Hoy la Ágora puede acercarse vía hilos de barrio, pero el modelo de "práctica recurrente con tipo, frecuencia, estacionalidad, agentes organizadores" es muy superior a una colección de hilos.

---

## 4. Cuatro ejes de caracterización (para Espacios)

Solo se aplican al objeto **Espacio**. NODOS los validó iterando con talleres durante 5 años:

### 4.1 Tipo de espacio

```
Espacio
├── Local (cerrado)
│   ├── Equipamiento cultural    ← formal, función cultural específica
│   └── Espacio alternativo      ← informal, uso reapropiado
└── Espacio público (abierto)
```

Distribución empírica que reportan: equipamiento cultural ~34%, alternativo ~39%, público ~27%. **Hallazgo central**: 76% del equipamiento formal está concentrado en Lima Centro. Esa asimetría territorial es la tesis política del mapa.

**Para KOINOS**: equivalente a la tipología actual de bloques (común/residente/autónomo/rentista/corporativo) pero con foco en función no en titularidad. Son ejes complementarios, no contradictorios.

### 4.2 Manifestaciones (multi)

Plástica, audiovisual, performativa, literaria. Un espacio puede tener varias. Se registran como `manifestaciones: string[]` con `manifestacion_principal` opcional para color de marcador. Filtros operan con OR.

**Hallazgo de campo de NODOS**: la manifestación performativa se distribuye casi homogéneamente; las otras tres concentradas en Centro. Norte/Sur/Este predominan **danzas tradicionales** que merecen sub-clasificación regional. Esto es trabajo etnográfico puro.

### 4.3 Formas de gestión

- **Autogestionada** — sociedad civil, colectivos
- **Institucional privada** — ONGs, fundaciones, embajadas
- **Estatal nacional** — ministerio, BNP
- **Estatal municipal** — municipalidades
- **Comunitaria** — comunidades organizadas (Comunidad Shipiba Cantagallo)
- **Mixta** — alianzas público-privadas

NODOS prefiere "alternativo" (eje 1) para "lugares creados por la sociedad civil". Eje 1 (sub-tipo Alternativo) **se solapa** con Eje 3 (Autogestionada). No son sinónimos pero hay correlación alta — mantenerlos separados permite cruces.

### 4.4 Enfoques movilizadores

Aquí NODOS arriesga operacionalizaciones que validan en taller:

| Enfoque | Definición operativa |
|---|---|
| Producción / consumo | Programación regular para público amplio |
| Memoria / historia | Preservar y narrar memoria colectiva |
| Comunitario / barrial | Activación cultural ligada al barrio inmediato |
| Identidad / pertenencia | Comunidades específicas (Shipiba, peñas afroperuanas, Brisas del Titicaca) |
| Formación / pedagógico | Función principal es formar |
| Reivindicativo / activista | Agenda explícita género, ambiental, derechos, decolonial |
| Patrimonial | Conservación y puesta en valor del patrimonio |

**Equivalencia KOINOS**: aquí no tenemos equivalente directo porque nuestra sección PHAROS atiende temas, no agendas. Podría pensarse un eje "agenda del bloque" o "para qué moviliza este espacio" — útil cuando empecemos a categorizar bloques recuperados por uso.

---

## 5. Cuatro métodos de captura

Todo registro de NODOS lleva un campo `metodo_captura`. Cuatro posibles, todos extraídos de literatura de mapeo participativo:

| Método | Cómo funciona | Confiabilidad |
|---|---|---|
| **Presencial** | Talleres grupales con dinámicas in situ — base sociológica clásica | Alta |
| **Virtual** | Formulario web abierto al público | Media (depende de moderación) |
| **Itinerante** | Intervenciones urbanas de mapeo en espacio público (mesa con tablet/papel) | Alta — se valida en el momento |
| **Por redes y web** | Auto-mapeo: el gestor cultural registra su propio espacio | Variable — útil para cobertura, debe re-validarse |

**Por qué importa**: permite filtrar por confiabilidad, rastrear qué taller produjo qué dato, y re-validar lo mapeado en redes mediante un taller posterior. Lo que en KOINOS llamaríamos "auditoría del dato cívico".

**Implicancia operativa para KOINOS**: cualquier `contribuciones` debería llevar también `metodo_captura`. Hoy todas se tratan iguales.

---

## 6. La distinción Duxbury — lo más político del marco

Nancy Duxbury (2019, *Cultural Mapping as Cultural Inquiry*) distingue dos tipos de mapeo cultural:

- **Tipo inventario** — recopilación de bienes culturales tangibles, registro técnico. Ejemplos: Atlas de Infraestructura Cultural del Mincul Perú 2011, Mapa Literario de Lima 2016.
- **Tipo humanístico** — participación comunitaria, espacio de encuentro y construcción de relatos colectivos, representaciones subjetivas y complejas. Ejemplos: Iconoclasistas (Argentina), GeoBrujas (México), Comunespacio "Borda tu ruta" (Perú).

**NODOS se ubica explícitamente en el humanístico** y acepta que su producto es un híbrido (cartografías combinan registro técnico con dimensión humanística).

Cita literal del expediente:

> "El mockup no debe parecerse a un Google Maps con pines. Tiene que comunicar que este es un mapa de memorias y relaciones, no un directorio."

**Esto debería estar tatuado en el repo de KOINOS.** Polis tiende al inventario por la naturaleza catastral de los datos. La modal `BarrioModal` actual es más directorio que memoria — la composición porcentual no cuenta historias. La doctrina humanística de Duxbury dice que la ficha debería poder llevar testimonios cortos de vecinos, fotos del barrio en distintas épocas, relatos. Una cosa pendiente.

---

## 7. Provenance y multi-cohorte

NODOS lleva 6 ciclos de mapeo registrados:

| Año | Cartografía | Métodos |
|---|---|---|
| 2021 | Lima Norte, Sur, Este, Centro (fundacional) | Virtual |
| 2022 | Lince, Jesús María, Santa Beatriz | Itinerante + virtual |
| 2023 | Pueblo Libre, Magdalena, San Miguel | Presencial + itinerante + virtual |
| 2024 | Actualización general de Lima | Virtual |
| 2025 | Lima Norte (re-mapeo, festival Cultura Conera) | Itinerante |
| 2026 | Comas (en curso, comunitaria) | Presencial + itinerante |

Cada registro de espacio/agente/práctica se ancla a un `proyecto_cartografico`. **Un mismo espacio puede haber sido mapeado en varios ciclos** y la plataforma debe poder versionar — re-validar, sobreescribir o conservar histórico según política editorial.

**Pregunta abierta importante**: cuando se re-mapea Lima Norte 2025 sobre Lima Norte 2021, ¿los registros se sobreescriben o se versionan? NODOS no la tiene cerrada. KOINOS la heredará si trabaja por cohortes (talleres por barrio).

---

## 8. Glosario regional y lenguaje vivo

Una lección de campo: las categorías genéricas no funcionan en todas las zonas. Específicamente:

- En **Lima Centro** se mapean "salas de música en vivo", "peñas", "galerías".
- En **Lima Norte/Sur/Este** y zonas populares, los conceptos vivos son **yunzas, polladas, pasacalles, danzas afroperuanas, danzas urbanas**.

El v0.2 documentado por Pancho propone un "diccionario regional" como mejora futura. Es decir: **el mismo eje "manifestaciones" se nombra distinto según la zona**, y la plataforma debería respetarlo.

**Para KOINOS / Canarias**: equivalente a entender que el "común" en Vegueta no es lo mismo que en Anaga, y que las prácticas vivas en cada zona tienen su propio vocabulario. Romería ≠ encuentro vecinal ≠ asamblea ≠ guateque ≠ rancho. La plataforma debería poder absorber ese vocabulario sin imponer una sola etiqueta.

---

## 9. Marco teórico citado por NODOS

Útil tenerlo a mano porque parte del trabajo de KOINOS es construir su propio marco — y NODOS ya hizo el trabajo de identificar los referentes que importan:

| Referente | Aporte | Cita típica |
|---|---|---|
| **J.B. Harley** (1989) | Cartografía crítica — los mapas son construcciones sociales que reflejan poder | "Deconstructing the map" |
| **Paulo Freire** | Pedagogía crítica — construcción dialógica del conocimiento | *Pedagogía del oprimido* |
| **Boaventura de Sousa Santos** (2009) | Epistemologías del Sur — visibilizar conocimientos silenciados | *Una epistemología del Sur* |
| **Iconoclasistas** (Argentina, 2013) | Manual de mapeo colectivo, referente operativo | *Manual de mapeo colectivo* |
| **Nancy Duxbury** (2015, 2019) | Cultural mapping inventario vs humanístico | *Cultural Mapping as Cultural Inquiry* |
| **VIC — Vivero de Iniciativas Ciudadanas** (2017) | Manual operativo para España | *Cómo hacer un mapeo colectivo* |

**Para KOINOS**: estos seis textos forman una bibliografía mínima razonable para sostener teóricamente el OCRE. El cursus honorum + los ejes Koinonía/Paideía/Politeía pueden citarlos sin forzar — la genealogía es la misma.

---

## 10. Lecciones operativas absorbibles a KOINOS

De todo lo anterior, estas son las piezas concretas que merecería trasladar al modelo de Demos iOS, en orden de impacto/coste:

1. **Provenance en `contribuciones`**: añadir columnas `metodo_captura` (enum: presencial/virtual/itinerante/redes) y `cohorte_cartografica` (FK a tabla `cohortes` que registra ciclos). Coste: una migración SQL. Beneficio: distinguir contribuciones validadas en taller de contribuciones de redes sin verificar.

2. **Tabla `agentes`**: distinta de `profiles`. Una cooperativa de vecinos no es un usuario, es una entidad cívica que vive aunque ningún miembro tenga cuenta en la plataforma. Schema: `id, nombre, tipo, alcance_territorial, espacios_vinculados, agentes_relacionados, fundacion, url`. Coste medio. Beneficio: poder mapear la red asociativa real de Canarias sin obligar a nadie a abrirse cuenta.

3. **Tabla `practicas`**: las dinámicas vivas con sus tipos, frecuencias y ubicación móvil. Schema en §3.3. Coste medio-alto (UI requiere mapa que renderice circulos difusos por barrio para itinerantes). Beneficio: el común vivo, no el común catastral.

4. **Ficha de bloque/barrio enriquecida con testimonios**: la `BarrioModal` actual debería poder mostrar relatos cortos contribuidos por usuarios. Tabla `testimonios` con `target_id` (barrio o bloque) + `texto` + `audio_url` opcional + autor. Coste medio. Beneficio: salirse del directorio Duxbury-inventario.

5. **Diccionario regional**: una tabla `vocabulario(slug, region, etiqueta_local)` que permite que "asamblea" se llame "asamblea" en Tenerife pero "encuentro de vecinos" en La Gomera. Coste bajo. Beneficio: respeta el lenguaje vivo.

6. **Cohortes cartográficas como ciudadanas activas en KOINOS**: un "taller de mapeo Vegueta 2027" debería ser una entidad de primera clase, con miembros, fechas, método y deliverable. Tabla `cohortes`. Permite organizar la actividad sociológica real cuando llegue.

7. **Adoptar la cita Duxbury como principio editorial**: no es código, es decisión de producto. Cualquier nueva pantalla de Polis debería pasar el filtro "¿esto comunica memorias y relaciones, o es un directorio?" Si es directorio, replantear.

8. **Separar `cartografía cultural a nivel ciudad` de `cartografía comunitaria por barrio`**: hoy Polis es lo primero. Lo segundo (un Vegueta navegable con su tejido propio, sus colectivos, sus prácticas, sus testimonios) sería un modo nuevo y mucho más rico, accesible al hacer drill-down sobre un barrio.

---

## 11. Bibliografía mínima recomendada

Lo que tendría sentido tener leído en KOINOS si el proyecto se toma en serio el mapeo participativo:

- Harley, J.B. (1989). *Deconstructing the map*. Cartographica 26(2).
- Freire, P. (1970). *Pedagogía del oprimido*.
- De Sousa Santos, B. (2009). *Una epistemología del Sur*.
- Iconoclasistas (2013). *Manual de mapeo colectivo*. Disponible en abierto en iconoclasistas.net.
- Duxbury, N., Garrett-Petts, W.F. & MacLennan, D. (2015). *Cultural Mapping as Cultural Inquiry*. Routledge.
- VIC — Vivero de Iniciativas Ciudadanas (2017). *Cómo hacer un mapeo colectivo*.
- El propio paper SciELO 2023 de Nodos Culturales (referenciado en su web).

Y tres textos canarios que enmarcarían la versión local:

- *Memorias del común insular* (cualquier estudio comparativo serio sobre el común en Canarias previo al turismo masivo).
- Trabajo de J. Alemán o E. Estévez sobre territorio y vivienda en Canarias post-2008.
- Cualquier monografía del CCPC sobre patrimonio inmaterial canario (ranchos de ánimas, fiestas patronales, salinas comunales).

---

## 12. Coda

NODOS no es importable como software. Es importable como **escuela**. Su valor para KOINOS no está en absorber sus polígonos OSM (los nuestros son mejores) ni en heredar su stack (el nuestro es mejor); está en absorber **la doctrina sociológica que sostiene su aproximación**:

- Mapear es político.
- Tres ontologías, no una.
- La provenance es parte del dato.
- Hay vocabulario vivo y vocabulario muerto: respetar el primero.
- Inventario vs humanístico: elegir humanístico siempre que se pueda.
- Las cohortes de mapeo son comunidades en sí mismas.

Esta doctrina lleva 5 años formándose en talleres reales en barrios de Lima. Heredarla cuesta lo que cuesta este documento. No heredarla es perder una herencia gratuita.
