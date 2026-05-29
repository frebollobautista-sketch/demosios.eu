# DATOS-CÍVICOS-ROADMAP · OCRE · POLIS

> Roadmap definitivo de datasets cívicos para convertir el visor isométrico de Canarias en **espacio democrático digital**.
> Documento de referencia, no brief operativo. Versión 1 — 2026-05-25.
> Autor: agente de roadmap de datos cívicos (Claude Opus 4.7) bajo dirección de Pancho.

---

## 0. Índice rápido

- [1. Tesis del documento](#1-tesis-del-documento)
- [2. Estado actual: qué hay ya integrado](#2-estado-actual-qué-hay-ya-integrado)
- [3. Las trece categorías cívicas](#3-las-trece-categorías-cívicas)
- [4. Catálogo de datasets propuestos](#4-catálogo-de-datasets-propuestos)
  - [4.1 Movilidad sostenible](#41-movilidad-sostenible)
  - [4.2 Vivienda y derecho a la ciudad](#42-vivienda-y-derecho-a-la-ciudad)
  - [4.3 Salud y cuidados](#43-salud-y-cuidados)
  - [4.4 Educación a lo largo de la vida](#44-educación-a-lo-largo-de-la-vida)
  - [4.5 Cultura, ocio y patrimonio](#45-cultura-ocio-y-patrimonio)
  - [4.6 Alimentación soberana](#46-alimentación-soberana)
  - [4.7 Espacio público, naturaleza y clima](#47-espacio-público-naturaleza-y-clima)
  - [4.8 Tejido social y cuidados comunitarios](#48-tejido-social-y-cuidados-comunitarios)
  - [4.9 Trabajo y economía local](#49-trabajo-y-economía-local)
  - [4.10 Participación democrática](#410-participación-democrática)
  - [4.11 Brecha digital y derecho al acceso](#411-brecha-digital-y-derecho-al-acceso)
  - [4.12 Memoria histórica e identidad canaria](#412-memoria-histórica-e-identidad-canaria)
  - [4.13 Riesgos ambientales y resiliencia](#413-riesgos-ambientales-y-resiliencia)
- [5. Priorización en tres olas](#5-priorización-en-tres-olas)
- [6. Auditoría de fuentes públicas (vivas en 2026)](#6-auditoría-de-fuentes-públicas-vivas-en-2026)
- [7. Datos democráticos digitales — sección especial](#7-datos-democráticos-digitales--sección-especial)
- [8. Riesgos y consideraciones](#8-riesgos-y-consideraciones)
- [9. Recomendación final: los tres datasets para esta semana](#9-recomendación-final-los-tres-datasets-para-esta-semana)
- [10. Cómo se usa este documento](#10-cómo-se-usa-este-documento)

---

## 1. Tesis del documento

POLIS hoy es **un mapa cívico bonito**. Tiene 14 overlays cubriendo movilidad, vivienda, educación, salud, cultura y tejido social, todos en `public/polis-app/overlays/`. La base es sólida y la doctrina visual (paper-ocre-ink, identidad por barrio, peek vs tap) ya filtra cualquier capa entrante.

El siguiente salto no es **más capas**: es transformar el visor en **espacio democrático digital**. Eso significa tres cosas concretas:

1. **Datos que activan decisión** — no solo describen el territorio, sino que permiten a vecinos identificar dónde presionar (presupuestos participativos, plenos, contratos, subvenciones).
2. **Datos que activan cuidado** — equipamientos donde se puede ayudar o ser ayudado (huertos, bancos del tiempo, comedores escolares, dependencia).
3. **Datos que activan memoria** — capas que cuentan **por qué** este barrio es como es (heredamientos, toponimia, patrimonio inmaterial, lugares de memoria).

El documento prioriza datasets por su capacidad de habilitar **gestos cívicos** sobre el mapa, no por su densidad informacional. Mejor 10 capas que invitan a tocar/decidir que 50 que solo se pueden mirar.

**Restricción cruzada con la doctrina visual**: ninguna capa entra sin pensar cómo se peek (popup chascarrillo) y cómo se tap (acción concreta). Los datasets propuestos llevan ya esa hipótesis incorporada en la columna "interacción cívica".

---

## 2. Estado actual: qué hay ya integrado

Inventario a 2026-05-25, leído de `/Users/panch/KOINOS-iso/public/polis-app/overlays/index.js`:

| Overlay | Categoría runtime | Niveles | Fuente real |
|---|---|---|---|
| `barrios` | identidad | municipio, distrito | `barrios-canonical.json` propio + OSM places |
| `renta` | vivienda | mun, distrito, barrio | INE Atlas ADRH 2023 (vía ISTAC) |
| `vv` | vivienda | isla → sección | Registro General Turístico de Canarias |
| `parques` | verdes | mun, distrito, sección | OSM (PBF Geofabrik) |
| `cobertura` | movilidad | mun, distrito, sección | GTFS Guaguas + Titsa (radios servicio) |
| `guaguas` | movilidad | mun, distrito, sección | GTFS feeds |
| `educacion` | equipamientos | isla → sección | `centros-educativos-prov35.geojson` (GobCan) |
| `lista-espera` | desigualdades | isla → sección | SCS lista espera quirúrgica |
| `eventos` | cultura | todos los niveles | curado manual + scraping cultural |
| `productores` | cultura | isla → sección | `productores-locales.geojson` curado |
| `tejido-social` | comunidad | isla → sección | 135 asociaciones curadas |
| `registro-oficial` | comunidad | todos | Registro Asociaciones GobCan |
| `cultura-venues` | cultura | isla → sección | 691 sedes OSM PBF (bibliotecas, museos, teatros, centros) |

**Datasets brutos disponibles ya descargados** (no overlay):

- `public/GEOFABRIK/canary-islands-latest.osm.pbf` — toda Canarias en OSM, sin minar.
- `public/osm-gc/` y `public/osm-prov38/` — buildings + roads + water + coastline + parks ya extraídos.
- `public/sections_pack/{cusec}/` — 1.381 secciones censales con geometría y stats.
- `public/data/islas-canarias.geojson`, `municipios-info.json`, `barrios-canarias-final.json`.
- `public/data/renta-municipio.json` + `renta-seccion.json` (ISTAC ADRH).

**Lectura clave**: la base visual y de equipamientos está. **Lo que falta es el tejido participativo y de decisión** — votaciones, presupuestos, contratos, plenos, subvenciones, calidad del aire, riesgos. Ahí es donde el espacio democrático digital toma forma.

---

## 3. Las trece categorías cívicas

Cada dataset propuesto pertenece a una de estas trece categorías. Mantengo las propuestas por Pancho con dos pequeños ajustes:

| # | Categoría | Pregunta cívica que responde |
|---|---|---|
| 1 | Movilidad sostenible | ¿Puedo moverme sin coche por mi barrio? |
| 2 | Vivienda y derecho a la ciudad | ¿Quién es dueño de lo que habito? |
| 3 | Salud y cuidados | ¿A qué distancia está el cuidado que necesito? |
| 4 | Educación a lo largo de la vida | ¿Mi barrio educa? ¿A qué edades, en qué? |
| 5 | Cultura, ocio y patrimonio | ¿Qué memoria viva tiene este lugar? |
| 6 | Alimentación soberana | ¿De dónde como? ¿Quién produce cerca? |
| 7 | Espacio público, naturaleza y clima | ¿Qué metros cuadrados de común me corresponden? |
| 8 | Tejido social y cuidados comunitarios | ¿Quién organiza vida colectiva aquí? |
| 9 | Trabajo y economía local | ¿Qué se produce en mi sección? ¿A quién le da empleo? |
| 10 | Participación democrática | ¿Dónde se decide lo que me afecta? ¿Puedo influir? |
| 11 | Brecha digital y derecho al acceso | ¿Tengo wifi público, fibra, equipamiento digital cercano? |
| 12 | Memoria histórica e identidad canaria | ¿Qué pasó aquí antes de que llegara la grúa? |
| 13 | Riesgos ambientales y resiliencia | ¿Vivo en zona inundable, volcánica, sísmica? ¿Qué se hace? |

Las categorías 10, 12 y 13 son las que más infrautilizadas están hoy en el visor — son las que activan más fuerte el "espacio democrático digital".

---

## 4. Catálogo de datasets propuestos

Formato común por dataset:

- **Nombre** · **Categoría** · **Fuente** · **Formato** · **Esfuerzo** · **Impacto** · **Sinergias** · **Estado** · **Por qué importa** · **Interacción cívica posible**

Escala de esfuerzo: **XS** (<1h) / **S** (medio día) / **M** (1-2 días) / **L** (semana) / **XL** (más).
Escala de impacto: **Bajo** / **Medio** / **Alto** / **Crítico**.

### 4.1 Movilidad sostenible

#### MOV-01 · Paradas Titsa con líneas reales (no solo cobertura)
- **Fuente**: GTFS oficial Titsa, https://www.titsa.com/Google_transit.zip, actualizado semanal. Replicado en Mobility Database y Transitland.
- **Formato**: GTFS (estándar bien soportado).
- **Esfuerzo**: S (los stops/routes/trips ya están parseables, solo falta diferenciar provincial vs municipal).
- **Impacto**: Alto en TF (cubre toda la isla). Hoy solo se muestra como radio cobertura, no como itinerario real.
- **Sinergias**: Cruce con `cobertura`, `educacion`, `lista-espera` para detectar **secciones sin acceso a hospital en transporte público**.
- **Estado**: Disponible directo.
- **Por qué importa**: Permite afirmar "esta sección tiene 0 paradas en 400m de centro de salud" — gesto democrático claro.
- **Interacción cívica**: tap en parada = horarios + frecuencia hoy; peek = "qué pasa si esta línea desaparece".

#### MOV-02 · Carriles bici, peatonales y zonas 30
- **Fuente**: OSM tags `highway=cycleway`, `cycleway:lane=*`, `maxspeed=30`, `highway=pedestrian`. Ya están en el PBF Geofabrik descargado.
- **Formato**: GeoJSON extraído del PBF.
- **Esfuerzo**: S (un solo pase de osmium/pyrosm con tag filter).
- **Impacto**: Alto. Hoy invisible.
- **Sinergias**: Cruce con `parques` (¿el carril conecta espacios verdes?), `educacion` (¿llega a escuelas?).
- **Estado**: Disponible directo.
- **Por qué importa**: Visibiliza el déficit estructural de movilidad blanda en LPGC/SCT.
- **Interacción cívica**: peek = "X metros de carril bici en tu barrio vs media insular"; tap = link a campaña vecinal de pacificación.

#### MOV-03 · Aparcabicis, estaciones de carga eléctrica, BiciAmbiental/Sítycleta
- **Fuente**: OSM tag `amenity=bicycle_parking`, `amenity=charging_station`. Sítycleta tiene API pública.
- **Formato**: GeoJSON + REST.
- **Esfuerzo**: S.
- **Impacto**: Medio.
- **Sinergias**: con MOV-02 forma una capa "movilidad blanda".
- **Estado**: Disponible directo.
- **Por qué importa**: Comparativa contundente entre islas y barrios.
- **Interacción cívica**: tap = disponibilidad en vivo (Sítycleta); peek = ratio aparcamientos coche/bici en sección.

#### MOV-04 · Tráfico medio diario y siniestralidad vial
- **Fuente**: Cabildos (TF tiene `https://datos.tenerife.es` con 53 datasets transporte). DGT publica anuarios siniestralidad nacional con desagregación a vía y municipio.
- **Formato**: CSV.
- **Esfuerzo**: M (cruzar siniestralidad con tramo OSM).
- **Impacto**: Alto.
- **Sinergias**: con MOV-02 sostiene argumento "esta avenida mata, hay que pacificar".
- **Estado**: Requiere transformación.
- **Por qué importa**: Habilita gesto "esta intersección lleva N atropellos en 3 años".

#### MOV-05 · Líneas Metrotranvía Tenerife + tren del sur (proyecto)
- **Fuente**: Transitland feed `f-metrotenerife`. Para el tren del sur, planos del proyecto liberados por Cabildo TF.
- **Formato**: GTFS + KML manual del proyecto.
- **Esfuerzo**: S (metro), M (proyecto tren del sur con histórico de modificaciones).
- **Impacto**: Crítico en TF metropolitano.
- **Sinergias**: con MOV-01.
- **Estado**: Disponible directo.

#### MOV-06 · Aparcamientos disuasorios y P+R
- **Fuente**: OSM `amenity=parking` + filtrado por tag `park_ride=yes`; complementar con webs municipales.
- **Formato**: GeoJSON.
- **Esfuerzo**: S.
- **Impacto**: Medio.
- **Estado**: Disponible directo.

### 4.2 Vivienda y derecho a la ciudad

#### VIV-01 · Catastro INSPIRE — edificios, parcelas, direcciones
- **Fuente**: Sede Electrónica del Catastro, servicios ATOM/WFS/WMS por municipio. https://www.catastro.hacienda.gob.es/webinspire/
- **Formato**: GML (zip por municipio), reproyectable a GeoJSON. ~1.48M edificios para Canarias.
- **Esfuerzo**: M (descarga masiva + reproyección + diff con buildings OSM ya extraídos).
- **Impacto**: Crítico. Es la base para "recuperación virtual" de OCRE.
- **Sinergias**: Con todo. Es el lienzo bajo todo lo demás.
- **Estado**: Disponible directo (CC-BY).
- **Por qué importa**: Cruzando referencia catastral con titularidad (cuando esté disponible) se identifica patrimonio concentrado: SOCIMIs, fondos, grandes tenedores.
- **Interacción cívica**: peek = "este bloque tiene 18 viviendas, 3 propietarios"; tap = ficha catastral + alerta vacancia/turistización.

#### VIV-02 · Vivienda pública (parque autonómico ICAVI + parque municipal)
- **Fuente**: ICAVI (Instituto Canario de la Vivienda) — pendiente verificar publicación abierta. Solicitudes ley transparencia si no.
- **Formato**: Pendiente.
- **Esfuerzo**: L (probablemente requiere petición formal).
- **Impacto**: Crítico.
- **Sinergias**: con VIV-01, VIV-06 dibuja el común habitacional.
- **Estado**: **Pendiente desbloquear**. Estimado: petición ley transparencia → 1-3 meses.

#### VIV-03 · Desahucios judiciales por partido judicial
- **Fuente**: CGPJ — Boletín de Información Estadística publica trimestralmente por partido judicial.
- **Formato**: PDF/XLSX que hay que parsear; CGPJ no publica JSON.
- **Esfuerzo**: M (scraper + normalización a municipio).
- **Impacto**: Crítico.
- **Sinergias**: con `renta`, `vv`, VIV-01.
- **Estado**: Requiere transformación.
- **Por qué importa**: Sin esto no se sostiene el discurso "Canarias expulsa".

#### VIV-04 · Precio medio de alquiler por sección (Idealista/Fotocasa scraped + INE encuesta)
- **Fuente**: INE Encuesta Continua de Hogares + portales privados (uso ético: agregado por sección, no listings individuales).
- **Formato**: CSV (INE) + scraping responsable.
- **Esfuerzo**: M-L (legalidad gris en scraping de portales).
- **Impacto**: Alto.
- **Sinergias**: cruzar con `renta` da el ratio precio/renta = índice expulsión.
- **Estado**: Requiere acuerdo o investigación previa.

#### VIV-05 · Vivienda vacía detectada (consumo eléctrico bajo en padrón)
- **Fuente**: Cruce INE consumo + padrón. Hay metodología publicada pero no dataset open.
- **Formato**: Reconstrucción propia.
- **Esfuerzo**: XL (es un proyecto de tesis).
- **Impacto**: Crítico.
- **Estado**: Pendiente desbloquear.
- **Por qué importa**: Sin dato de vacío, el discurso vivienda se cae.

#### VIV-06 · Suelo público disponible y patrimonio municipal
- **Fuente**: Inventarios de bienes municipales (publicación obligada por Ley 7/1985). Cada ayuntamiento publica con calidad muy desigual.
- **Formato**: PDF/XLSX.
- **Esfuerzo**: L (un municipio = un scraper distinto).
- **Impacto**: Alto.
- **Estado**: Requiere transformación + paciencia.

#### VIV-07 · Planeamiento urbanístico (PGOU vigente + suelos categorizados)
- **Fuente**: `https://opendata.sitcan.es/dataset/planeamiento-urbanistico-de-las-palmas-de-gran-canaria` — Gobierno de Canarias publica varias capas. Idem otros municipios vía SITCAN.
- **Formato**: WMS/WFS + shapefile descargable.
- **Esfuerzo**: M.
- **Impacto**: Crítico (urbanismo es la madre del cordero canario).
- **Sinergias**: con VIV-01, `parques`, MOV-02.
- **Estado**: Disponible directo (parcial — depende municipio).
- **Por qué importa**: Visibiliza suelos que van a edificarse, zonas verdes recalificadas, etc.
- **Interacción cívica**: peek = "este solar está catalogado como SR1, edificable hasta X plantas"; tap = link al PGOU + alertas modificaciones.

### 4.3 Salud y cuidados

#### SAL-01 · Centros de Atención Primaria con horarios y especialidades
- **Fuente**: SCS — directorios disponibles en `www3.gobiernodecanarias.org/sanidad/scs/`, no en GeoJSON abierto. Hay que geocodificar.
- **Formato**: HTML scraping → GeoJSON.
- **Esfuerzo**: M.
- **Impacto**: Crítico.
- **Sinergias**: con `lista-espera`, MOV-01.
- **Estado**: Requiere transformación.
- **Interacción cívica**: peek = "el centro está a 1.2km, accesible por la línea 25, horario 8-20"; tap = teléfono cita.

#### SAL-02 · Hospitales públicos y concertados (incluye camas, urgencias)
- **Fuente**: SCS + datos.canarias.es. La capa `lista-espera` ya tiene parte.
- **Formato**: GeoJSON.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo (en mejor estado que centros AP).

#### SAL-03 · Farmacias con guardia rotatoria
- **Fuente**: Colegio Oficial Farmacéuticos LP y SCT. Datos abiertos no estandarizados.
- **Formato**: HTML scraping.
- **Esfuerzo**: M (la guardia cambia diaria/semanalmente).
- **Impacto**: Medio.
- **Estado**: Requiere transformación.

#### SAL-04 · Servicios de Atención a la Dependencia y residencias
- **Fuente**: IMSERSO + Gobierno de Canarias Bienestar Social. Datos abiertos parciales.
- **Formato**: CSV/GeoJSON.
- **Esfuerzo**: M.
- **Impacto**: Crítico (envejecimiento canario).
- **Estado**: Requiere transformación + chequeo licencia.

#### SAL-05 · Bancos de leche, centros mujer víctima violencia, salud mental
- **Fuente**: Servicios sociales municipales y autonómicos. Mezcla de PDFs.
- **Formato**: Manual + scraping.
- **Esfuerzo**: M-L.
- **Impacto**: Crítico.
- **Estado**: Pendiente fuente.
- **Notas privacidad**: ubicación exacta de casas de acogida NO se publica. Solo "tu municipio tiene servicio".

#### SAL-06 · Programa de Cribados y Vacunación: cobertura por zona básica salud
- **Fuente**: SCS Dirección General Salud Pública.
- **Formato**: PDF/XLSX.
- **Esfuerzo**: M.
- **Impacto**: Alto (refuerza confianza en lo público).
- **Estado**: Pendiente fuente.

### 4.4 Educación a lo largo de la vida

#### EDU-01 · Centros educativos prov 38 (Tenerife)
- **Fuente**: Consejería Educación Canarias. Hoy solo tenemos prov 35 (`centros-educativos-prov35.geojson`).
- **Formato**: CSV con dirección → geocodificar.
- **Esfuerzo**: S.
- **Impacto**: Alto (cierra simetría LP/TF).
- **Estado**: Disponible directo.
- **Interacción cívica**: idéntica a `educacion` actual.

#### EDU-02 · Centros con comedor escolar (gratuito vs concertado) y becas
- **Fuente**: Consejería Educación + estadísticas anuales.
- **Formato**: CSV.
- **Esfuerzo**: M.
- **Impacto**: Crítico (pobreza infantil).
- **Sinergias**: con `renta`, EDU-01.
- **Estado**: Requiere transformación.
- **Interacción cívica**: peek = "% del alumnado del barrio con beca de comedor"; tap = info ayudas + voluntariado.

#### EDU-03 · Escuelas infantiles 0-3 (públicas, plazas y lista espera)
- **Fuente**: Consejería Educación + ayuntamientos.
- **Formato**: PDF/XLSX.
- **Esfuerzo**: M.
- **Impacto**: Crítico (corresponsabilidad).
- **Estado**: Requiere transformación.

#### EDU-04 · Educación de adultos (CEPA, escuela de idiomas, UNED)
- **Fuente**: Consejería + Ministerio.
- **Formato**: CSV.
- **Esfuerzo**: S.
- **Impacto**: Medio.
- **Estado**: Disponible directo.

#### EDU-05 · Universidades, campus, centros adscritos
- **Fuente**: ULPGC + ULL webs + OSM.
- **Formato**: KML/GeoJSON.
- **Esfuerzo**: S.
- **Impacto**: Medio.
- **Estado**: Disponible directo.

#### EDU-06 · Bibliotecas escolares y municipales (más allá de las venues OSM ya integradas)
- **Fuente**: Red Bibliotecas Canarias + ya minado del PBF.
- **Formato**: GeoJSON ya parcial (en `cultura-venues`).
- **Esfuerzo**: XS (enriquecer la capa cultura-venues existente con tag horario/colección).
- **Impacto**: Medio.
- **Estado**: Disponible directo.

### 4.5 Cultura, ocio y patrimonio

#### CUL-01 · Bienes de Interés Cultural (BIC) + patrimonio catalogado
- **Fuente**: `https://datos.canarias.es/catalogos/general/dataset` — Consejería Cultura publica BIC. IDECanarias tiene WMS de patrimonio.
- **Formato**: GeoJSON/WMS.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Sinergias**: con VIV-01 (¿qué BIC está privatizado?), `cultura-venues`.
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "BIC desde 1982, accesible/visitable o no"; tap = ficha + estado conservación.

#### CUL-02 · Patrimonio inmaterial: lugares con tradición viva (romerías, bajadas, bailes)
- **Fuente**: Inventario UNESCO + Cultura GobCan + curación manual.
- **Formato**: GeoJSON manual.
- **Esfuerzo**: M (curación).
- **Impacto**: Crítico para identidad.
- **Sinergias**: con `eventos` activa el calendario vivo.
- **Estado**: Requiere transformación.
- **Interacción cívica**: peek = "aquí se baja la Virgen del Pino cada 8 sept"; tap = vídeo + historia.

#### CUL-03 · Centros artesanos (FEDAC, FEDAC TF)
- **Fuente**: FEDAC Gran Canaria + Empresa Insular de Artesanía Tenerife.
- **Formato**: HTML.
- **Esfuerzo**: S.
- **Impacto**: Medio.
- **Estado**: Requiere transformación.

#### CUL-04 · Cines, teatros y festivales con programación viva (no solo dirección)
- **Fuente**: `cultura-venues` ya tiene el contenedor. Para programación: scraping por sede (Sala Insular, TEA, Auditorio Alfredo Kraus, Festival Internacional Tenerife).
- **Formato**: iCal por sede o scraping web.
- **Esfuerzo**: L (cada sede tiene web propia).
- **Impacto**: Alto.
- **Sinergias**: feed para `eventos`.
- **Estado**: Requiere transformación.

#### CUL-05 · Museos con horarios y precios + entrada gratuita
- **Fuente**: web museos individuales + OSM `tourism=museum`.
- **Formato**: Mix.
- **Esfuerzo**: M.
- **Impacto**: Medio.
- **Estado**: Requiere transformación.

#### CUL-06 · Antiguos cines, casinos y locales sociales hoy cerrados (capa fantasma)
- **Fuente**: Hemeroteca + curación local.
- **Formato**: Manual.
- **Esfuerzo**: L (es proyecto memoria).
- **Impacto**: Alto cultural (no decisión).
- **Estado**: Pendiente fuente.

### 4.6 Alimentación soberana

#### ALI-01 · Mercados municipales (Vegueta, Mercado Central SCT, etc.) + ferias semanales
- **Fuente**: OSM `amenity=marketplace` + curación municipal.
- **Formato**: GeoJSON.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo (OSM lo tiene + un pase de validación).
- **Sinergias**: con `productores`.

#### ALI-02 · Huertos urbanos comunitarios
- **Fuente**: Ayuntamientos LPGC, La Laguna, Adeje tienen programas. No hay registro unificado.
- **Formato**: Curación manual.
- **Esfuerzo**: M.
- **Impacto**: Alto (categoría ICA — Iniciativas Comunes Alimentarias).
- **Sinergias**: con `tejido-social`, ALI-04.
- **Estado**: Pendiente fuente unificada — construir colaborativamente.

#### ALI-03 · Cooperativas y grupos de consumo
- **Fuente**: Red Canaria de Semillas, Soberanía Alimentaria Canarias, Atlas Rural Gran Canaria.
- **Formato**: Curación.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación + alianza con Atlas Rural GC.

#### ALI-04 · Comedores sociales y bancos de alimentos
- **Fuente**: Cáritas + Cruz Roja + Banco Alimentos Las Palmas/Tenerife. Datos no abiertos.
- **Formato**: Web scraping con cuidado.
- **Esfuerzo**: M.
- **Impacto**: Crítico.
- **Estado**: Pendiente desbloquear (sensibilidad: no exponer usuarios).

#### ALI-05 · Mapa de cultivos de Canarias
- **Fuente**: SITCAN — `https://opendata.sitcan.es/upload/medio-rural/gobcan_mapa-cultivos_metodologia.pdf` confirma metodología. Capa real disponible.
- **Formato**: WMS/Shapefile.
- **Esfuerzo**: S.
- **Impacto**: Medio para urbanitas, alto para municipios rurales.
- **Estado**: Disponible directo.

### 4.7 Espacio público, naturaleza y clima

#### ESP-01 · Espacios Naturales Protegidos + Red Natura 2000
- **Fuente**: IDECanarias + Ministerio MITECO.
- **Formato**: WMS/Shapefile.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.
- **Sinergias**: con MOV-02, ESP-04.

#### ESP-02 · Playas con bandera azul + accesibilidad + duchas/socorrismo
- **Fuente**: ADEAC publica bandera azul. Accesibilidad: ayuntamientos. OSM tiene parte.
- **Formato**: Mix.
- **Esfuerzo**: M.
- **Impacto**: Alto turístico, medio cívico.
- **Estado**: Requiere transformación.

#### ESP-03 · Calidad del aire — estaciones CEGCA en tiempo real
- **Fuente**: Red Control y Vigilancia Calidad Aire Canarias — `https://www3.gobiernodecanarias.org/medioambiente/calidaddelaire/inicio.do` actualiza hora. Replicado en `datos.canarias.es/catalogos/general/dataset/calidad-del-aire-de-canarias` y AQICN.
- **Formato**: HTML + JSON (AQICN tiene JSON estable).
- **Esfuerzo**: S (proxy a AQICN) / M (estaciones oficiales scraping).
- **Impacto**: Crítico.
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "PM10 hoy 42 µg/m³ — por encima OMS"; tap = histórico + ¿qué hago si me afecta?

#### ESP-04 · Calidad del agua: playas no aptas baño + acuíferos
- **Fuente**: Consejería Sanidad publica analíticas playas. SAIH para acuíferos.
- **Formato**: PDF/CSV.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación.

#### ESP-05 · Árboles singulares y catálogo arbolado urbano
- **Fuente**: Catálogo Árboles Singulares Canarias (GobCan) + inventarios ayuntamientos.
- **Formato**: Shapefile/CSV.
- **Esfuerzo**: S.
- **Impacto**: Medio cívico, alto identitario.
- **Estado**: Disponible directo (parcial).
- **Interacción cívica**: peek = "drago centenario protegido"; tap = adoptar simbólicamente.

#### ESP-06 · Espacios verdes accesibles (parques públicos vs jardines privados)
- **Fuente**: OSM `leisure=park` (ya tenemos) + cruce con catastro VIV-01 para titularidad.
- **Formato**: GeoJSON.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación.

#### ESP-07 · Mobiliario urbano: bancos, fuentes, sombras
- **Fuente**: OSM `amenity=bench`, `amenity=drinking_water`. Ayuntamientos tienen inventario propio (LPGC publica fuentes en open data: confirmado en SCT también).
- **Formato**: GeoJSON.
- **Esfuerzo**: S.
- **Impacto**: Medio (alto en ola de calor).
- **Estado**: Disponible directo.

### 4.8 Tejido social y cuidados comunitarios

(Hoy ya cubierto parcialmente por `tejido-social` y `registro-oficial`. Profundizar:)

#### TEJ-01 · Bancos del tiempo y monedas locales
- **Fuente**: Curación + red estatal Banco del Tiempo.
- **Formato**: Manual.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Pendiente fuente.

#### TEJ-02 · Centros sociales okupados y autogestionados (capa sensible)
- **Fuente**: Curación con consentimiento del propio centro.
- **Formato**: Manual.
- **Esfuerzo**: L (relacional).
- **Impacto**: Alto político.
- **Estado**: Pendiente desbloquear (requiere ética: que cada centro decida si quiere estar).

#### TEJ-03 · AMPAS y federaciones de AMPAS por centro
- **Fuente**: Confederaciones AMPAS + propias asociaciones.
- **Formato**: HTML.
- **Esfuerzo**: M.
- **Impacto**: Alto (puerta a corresponsabilidad).
- **Estado**: Requiere transformación.

#### TEJ-04 · Centros cívicos municipales y casas de juventud
- **Fuente**: Webs municipales.
- **Formato**: HTML scraping → GeoJSON.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación. Parcialmente cubierto por `cultura-venues`.

#### TEJ-05 · Grupos cuidados: dependencia, infancia, salud mental peer
- **Fuente**: Red Servicios Sociales + ONGs.
- **Formato**: Curación.
- **Esfuerzo**: L.
- **Impacto**: Crítico.
- **Estado**: Pendiente fuente.

#### TEJ-06 · Voluntariado activo: huellas Cruz Roja, Cáritas, Open Arms en TF/LP
- **Fuente**: Webs ONGs.
- **Formato**: HTML.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación.

### 4.9 Trabajo y economía local

#### TRA-01 · Tasa de paro registrado por municipio (ISTAC)
- **Fuente**: `https://opendata.gobiernodecanarias.org/dataset/activity/paro-registrado-por-municipios-actualizados` + ISTAC `Indicadores laborales. Municipios de Canarias. 2024`.
- **Formato**: CSV (formato eficiente).
- **Esfuerzo**: XS.
- **Impacto**: Crítico.
- **Sinergias**: con `renta`, `vv`.
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "paro registrado tu municipio + diferencia respecto media"; tap = histórico desde 2008 (la crisis).

#### TRA-02 · Empresas activas por epígrafe IAE (SABI vía Universidad / DIRCE INE)
- **Fuente**: INE DIRCE público parcial. SABI requiere licencia.
- **Formato**: CSV agregado.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Disponible directo (parcial agregado).

#### TRA-03 · Convocatorias empleo público (oposiciones) por administración
- **Fuente**: BOC + Boletín Oficial del Estado + ayuntamientos.
- **Formato**: HTML/PDF.
- **Esfuerzo**: M.
- **Impacto**: Alto (interés ciudadano enorme).
- **Estado**: Requiere transformación.
- **Interacción cívica**: peek "X plazas convocadas en tu isla este mes"; tap = lista + fechas.

#### TRA-04 · Comercio local agremiado: zonas comerciales abiertas, asociaciones comerciantes
- **Fuente**: Confederaciones provinciales (CCE, FEPECO). HTML.
- **Esfuerzo**: M.
- **Impacto**: Medio.
- **Estado**: Requiere transformación.

#### TRA-05 · Renta media de mercado y salarios por sector (Agencia Tributaria municipalizado)
- **Fuente**: AEAT publica estadística IRPF por municipio anualmente.
- **Formato**: XLSX.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.
- **Sinergias**: con `renta` (renta ADRH) cruza renta declarada vs renta efectiva.

### 4.10 Participación democrática

**Esta es la categoría más importante para "espacio democrático digital". Detalle ampliado en §7.**

#### PAR-01 · Resultados electorales por sección — Generales, Autonómicas, Municipales, Europeas
- **Fuente**: Ministerio del Interior — Infoelectoral `https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/`. También `datos.gob.es/en/catalogo/a10002983-resultados-de-elecciones-generales-2023` con desglose por mesa.
- **Formato**: TXT-fixed-width oficial, varios proyectos GitHub ofrecen CSV/JSON parseado.
- **Esfuerzo**: M (parsear formato oficial es engorroso pero está documentado).
- **Impacto**: Crítico.
- **Sinergias**: cruce con `renta`, EDU-02, MOV-01 da los mapas "el barrio donde más vota X tiene Y".
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = resultado dominante de la sección; tap = evolución histórica + mapa comparativo + abstención.

#### PAR-02 · Presupuestos participativos LPGC (decide.laspalmasgc.es)
- **Fuente**: Plataforma CONSUL (open source). Tiene API potencial. Hoy datos crudos no publicados, hay que pedirlos o usar API CONSUL si está expuesta.
- **Formato**: API REST (si abierta) o scraping HTML.
- **Esfuerzo**: M.
- **Impacto**: Crítico.
- **Estado**: Pendiente verificar API.
- **Por qué importa**: LPGC moviliza 3M€/año por distritos. Visibilizarlos en el mapa cambia la dinámica.
- **Interacción cívica**: peek = "tu distrito tiene X proyectos en votación ahora"; tap = link directo a votar.

#### PAR-03 · Plenos municipales — actas, votaciones nominales, asistencia
- **Fuente**: Cada ayuntamiento publica en portal transparencia. Calidad muy desigual: LPGC publica actas PDF; ayuntamientos pequeños solo orden del día.
- **Formato**: PDF (scraping pesado).
- **Esfuerzo**: L (un parser por ayuntamiento).
- **Impacto**: Crítico.
- **Estado**: Requiere transformación.
- **Por qué importa**: Sin esto el pleno municipal es un agujero negro para 99% de vecinos.
- **Interacción cívica**: peek = "próximo pleno: 12 jun, 5 puntos de tu distrito"; tap = orden del día + cómo asistir.

#### PAR-04 · Contratación pública — Plataforma Contratación Sector Público (PLACSP)
- **Fuente**: `https://contrataciondelestado.es/wps/portal/plataforma/datos_abiertos/` — publica Atom/XML siguiendo RFC 4287. Herramienta OpenPLACSP.
- **Formato**: Atom/XML.
- **Esfuerzo**: M (parser + filtrado a entes canarios).
- **Impacto**: Crítico.
- **Sinergias**: con VIV-06 (¿qué obras se contratan en suelo público?).
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "contrato de X€ adjudicado a Z para obra en tu sección"; tap = ficha completa + ¿competencia o adjudicación directa?

#### PAR-05 · Subvenciones concedidas (Gobierno de Canarias + ayuntamientos)
- **Fuente**: `https://www.gobiernodecanarias.org/transparencia/temas/contratos-convenios-subvenciones/ayudas-y-subvenciones/ayudas-concedidas/` y dataset CSV en `datos.canarias.es/catalogos/general/dataset/subvenciones-premios-y-becas-del-gobierno-de-canarias/`.
- **Formato**: CSV.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "X subvenciones a entidades de tu barrio el último año"; tap = listado completo.

#### PAR-06 · Declaraciones bienes/actividades cargos públicos
- **Fuente**: Cada portal transparencia. Formato muy desigual.
- **Formato**: PDF.
- **Esfuerzo**: L.
- **Impacto**: Alto.
- **Estado**: Requiere transformación.

#### PAR-07 · Mociones aprobadas/rechazadas + asistencia nominal a plenos
- **Fuente**: Cruce con PAR-03.
- **Formato**: Derivado.
- **Esfuerzo**: M.
- **Impacto**: Crítico.
- **Estado**: Derivado de PAR-03.

#### PAR-08 · Consultas ciudadanas (consultas, audiencias, sometimientos a info pública)
- **Fuente**: Portal Gobierno Abierto Canarias + ayuntamientos.
- **Formato**: HTML.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación.
- **Interacción cívica**: peek = "consulta pública abierta sobre X en tu municipio, plazo 15 días"; tap = link.

#### PAR-09 · Iniciativas Legislativas Populares + recogida firmas
- **Fuente**: Parlamento Canarias + Congreso.
- **Formato**: HTML.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.

#### PAR-10 · Convocatorias asambleas vecinales (crowdsourced)
- **Fuente**: La propia comunidad POLIS lo aporta.
- **Formato**: Submission propia.
- **Esfuerzo**: L (requiere backend de gestión + moderación).
- **Impacto**: Crítico.
- **Estado**: Pendiente desbloquear (requiere Supabase live + tabla `convocatorias`).
- **Por qué importa**: Convierte el mapa de visor en agenda viva.

### 4.11 Brecha digital y derecho al acceso

#### DIG-01 · Cobertura fibra óptica por sección (Banda Ancha Ministerio)
- **Fuente**: Ministerio Asuntos Económicos — informes anuales cobertura banda ancha por sección.
- **Formato**: XLSX por NUTS3 + visor.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "92% sección con FTTH"; tap = quién opera + alternativas.

#### DIG-02 · WiFi público municipal
- **Fuente**: Ayuntamientos. OSM `internet_access=wlan;fee=no` parcialmente.
- **Formato**: GeoJSON.
- **Esfuerzo**: M.
- **Impacto**: Medio.
- **Estado**: Requiere transformación.

#### DIG-03 · Telecentros y Aulas Mentor (formación digital pública)
- **Fuente**: Ministerio + GobCan + ayuntamientos.
- **Formato**: CSV.
- **Esfuerzo**: S.
- **Impacto**: Alto (brecha digital mayores).
- **Estado**: Disponible directo.

#### DIG-04 · Equipamiento informático escuelas (Plan Escuela Digital)
- **Fuente**: Consejería Educación.
- **Formato**: Pendiente verificar.
- **Esfuerzo**: M.
- **Impacto**: Medio.
- **Estado**: Pendiente fuente.

### 4.12 Memoria histórica e identidad canaria

#### MEM-01 · Lugares de memoria democrática (Ley 19/2022 estatal + memoria insular)
- **Fuente**: Mapa memoria democrática Ministerio Presidencia. Cabildos publican planes propios.
- **Formato**: GeoJSON oficial.
- **Esfuerzo**: S.
- **Impacto**: Crítico identitario.
- **Estado**: Disponible directo.
- **Interacción cívica**: peek = "fosa común localizada aquí, 14 represaliados, exhumada 2019"; tap = relato + protocolo respeto.

#### MEM-02 · Toponimia tradicional vs oficial (recuperación nombres)
- **Fuente**: Academia Canaria de la Lengua + estudios locales + OSM tags `name:gcn` (no estándar — necesita propio tagging).
- **Formato**: GeoJSON manual.
- **Esfuerzo**: L.
- **Impacto**: Crítico.
- **Estado**: Pendiente fuente — proyecto Mnemósine ya tiene parte.
- **Interacción cívica**: peek = "llamado *Las Crucitas*, antiguo *Hoya 'e la Pera*"; tap = registro audio mayor del barrio (memoria oral).

#### MEM-03 · Heredamientos de agua (concejil canario tradicional)
- **Fuente**: Heredades de Aguas Arucas/Firgas/etc. Estudios académicos.
- **Formato**: Manual.
- **Esfuerzo**: L.
- **Impacto**: Crítico (la tesis OCRE: la tierra que fue común).
- **Estado**: Pendiente desbloquear.

#### MEM-04 · Yacimientos arqueológicos prehispánicos
- **Fuente**: Carta Arqueológica de cada isla — datos sensibles, no se publica ubicación exacta.
- **Formato**: WMS con buffer/aproximación.
- **Esfuerzo**: M (con cuidado: nunca exponer coordenadas exactas, riesgo expolio).
- **Impacto**: Alto.
- **Estado**: Pendiente desbloquear (requiere convenio con Consejería Patrimonio).

#### MEM-05 · Centros antiguos protegidos (cascos históricos catalogados)
- **Fuente**: PGOU + IDECanarias.
- **Formato**: Shapefile.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo (parcial).

#### MEM-06 · Casas de personajes canarios + lugares evento histórico
- **Fuente**: Mapping Canarias de Biblioteca de Canarias — ya existe `https://www.bibliotecadecanarias.org/recursos-digitales/mapping-canarias`. Curación.
- **Formato**: Mix.
- **Esfuerzo**: M.
- **Impacto**: Medio.
- **Estado**: Requiere transformación.

#### MEM-07 · Migración: lugares de embarque, retorno, pateras llegadas
- **Fuente**: Servicios Sociales + Cruz Roja + Diversidad Antropológica. Sensible.
- **Formato**: Manual.
- **Esfuerzo**: L.
- **Impacto**: Crítico.
- **Estado**: Pendiente desbloquear (riesgo: no convertir personas en pin de mapa).

### 4.13 Riesgos ambientales y resiliencia

#### RIE-01 · Mapas de inundación SNCZI (Sistema Nacional Cartografía Zonas Inundables)
- **Fuente**: MITECO — `https://www.miteco.gob.es/en/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html`.
- **Formato**: WMS/Shapefile.
- **Esfuerzo**: S.
- **Impacto**: Crítico.
- **Estado**: Disponible directo.

#### RIE-02 · Riesgo volcánico (PEVOLCA + Hub La Palma)
- **Fuente**: `https://riesgovolcanico-lapalma.hub.arcgis.com/` + RIESGOMAP de datos.canarias.es.
- **Formato**: WMS + ArcGIS REST.
- **Esfuerzo**: S.
- **Impacto**: Crítico.
- **Estado**: Disponible directo.

#### RIE-03 · Riesgo sísmico
- **Fuente**: IGN + datos.canarias.es RIESGOMAP.
- **Formato**: WMS.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.

#### RIE-04 · Riesgo incendio forestal (índices diarios + zonas alta peligrosidad histórica)
- **Fuente**: GobCan Medio Ambiente.
- **Formato**: WMS + actualización diaria temporada.
- **Esfuerzo**: M.
- **Impacto**: Crítico.
- **Estado**: Disponible directo (parcial).

#### RIE-05 · Cobertura calima/polvo (NAAPS, AQICN)
- **Fuente**: AQICN + AEMET.
- **Formato**: JSON tiempo real.
- **Esfuerzo**: S.
- **Impacto**: Alto.
- **Estado**: Disponible directo.

#### RIE-06 · Olas calor: registro y zonas climáticas + escuelas/residencias en zonas crítica
- **Fuente**: AEMET + cruce con EDU-01 + SAL-04.
- **Formato**: Derivado.
- **Esfuerzo**: M.
- **Impacto**: Crítico.
- **Estado**: Requiere transformación.

#### RIE-07 · Mapa subida nivel del mar (proyección IPCC adaptada a Canarias)
- **Fuente**: IPCC + estudios ULPGC/ULL.
- **Formato**: Reconstrucción.
- **Esfuerzo**: L.
- **Impacto**: Crítico.
- **Estado**: Pendiente fuente unificada.

#### RIE-08 · Puntos de encuentro emergencia y zonas seguras
- **Fuente**: Planes Emergencia Municipal — PEMU. Disparidad municipal.
- **Formato**: Mix.
- **Esfuerzo**: M.
- **Impacto**: Alto.
- **Estado**: Requiere transformación.

---

## 5. Priorización en tres olas

### Ola 1 — Ganancia inmediata (próximas 2 semanas)

Criterios: dataset abierto y descargable hoy, esfuerzo ≤ S, impacto alto, encaja con overlays existentes.

| ID | Dataset | Esfuerzo | Impacto | Por qué ahora |
|---|---|---|---|---|
| MOV-02 | Carriles bici + zonas 30 OSM | S | Alto | El PBF ya está descargado, un script más. |
| MOV-03 | Aparcabicis + Sítycleta | S | Medio | Cierra capa movilidad blanda. |
| EDU-01 | Centros educativos prov 38 | S | Alto | Simetría LP/TF, dataset abierto. |
| EDU-06 | Bibliotecas (enriquecer venues) | XS | Medio | 1h, mejora un overlay existente. |
| CUL-01 | BIC y patrimonio catalogado | S | Alto | Dataset abierto GobCan. |
| ALI-01 | Mercados municipales OSM | S | Alto | Tag OSM ya minable. |
| ESP-03 | Calidad del aire tiempo real (AQICN proxy) | S | Crítico | JSON estable, tiempo real, sin precedente en el visor. |
| ESP-05 | Árboles singulares Canarias | S | Medio | Identidad pura — dragos. |
| ESP-07 | Mobiliario urbano (bancos, fuentes, sombras) | S | Medio | OSM directo, alto valor en olas calor. |
| PAR-01 | Resultados electorales por sección | M (tope) | Crítico | Es el dataset democrático fundacional. Vale el esfuerzo. |
| PAR-05 | Subvenciones GobCan concedidas | S | Alto | CSV directo. |
| TRA-01 | Paro registrado por municipio (ISTAC) | XS | Crítico | Una llamada API. |

**Total Ola 1: 12 datasets**. Esfuerzo combinado estimado: 1.5-2 semanas focused work si se hace en serie; 1 semana si dos manos.

### Ola 2 — Profundidad cívica (1-2 meses)

Criterios: requiere parsers serios o cruce de fuentes; activa decisión o cuidado real.

| ID | Dataset | Esfuerzo | Impacto |
|---|---|---|---|
| VIV-01 | Catastro INSPIRE edificios | M | Crítico |
| VIV-03 | Desahucios judiciales por partido judicial | M | Crítico |
| VIV-07 | Planeamiento urbanístico SITCAN | M | Crítico |
| SAL-01 | Centros AP con horarios SCS | M | Crítico |
| SAL-04 | Servicios de dependencia y residencias | M | Crítico |
| EDU-02 | Comedores escolares + becas | M | Crítico |
| EDU-03 | Escuelas infantiles 0-3 | M | Crítico |
| CUL-02 | Patrimonio inmaterial canario | M | Crítico |
| ALI-02 | Huertos urbanos | M | Alto |
| ALI-03 | Cooperativas y grupos consumo | M | Alto |
| TEJ-03 | AMPAS por centro | M | Alto |
| TEJ-04 | Centros cívicos municipales | M | Alto |
| PAR-02 | Presupuestos participativos LPGC (API CONSUL) | M | Crítico |
| PAR-04 | Contratación pública PLACSP | M | Crítico |
| PAR-08 | Consultas ciudadanas activas | M | Alto |
| DIG-01 | Cobertura fibra por sección | S | Alto |
| DIG-03 | Telecentros y Aulas Mentor | S | Alto |
| MEM-01 | Lugares memoria democrática | S | Crítico |
| MEM-05 | Cascos históricos protegidos | S | Alto |
| RIE-01 | Inundación SNCZI | S | Crítico |
| RIE-02 | Riesgo volcánico | S | Crítico |
| RIE-03 | Riesgo sísmico | S | Alto |
| RIE-04 | Riesgo incendio forestal | M | Crítico |
| RIE-05 | Calima tiempo real | S | Alto |
| ESP-01 | Espacios Naturales Protegidos | S | Alto |
| ESP-02 | Playas bandera azul + accesibilidad | M | Alto |
| ESP-04 | Calidad agua playas | M | Alto |
| ESP-06 | Verdes accesibles vs privados | M | Alto |
| TRA-05 | IRPF municipalizado AEAT | S | Alto |
| TRA-03 | Convocatorias empleo público | M | Alto |
| MOV-01 | Paradas Titsa con líneas reales | S | Alto |
| MOV-05 | Metrotranvía + proyecto tren TF | S | Crítico |

**Total Ola 2: 32 datasets**. Aquí está la fuerza democrática real del visor.

### Ola 3 — Largo plazo (3-6 meses+)

Criterios: requiere acuerdos institucionales, scraping pesado, gestión crowdsourcing, o trabajo de campo.

| ID | Dataset | Bloqueante |
|---|---|---|
| VIV-02 | Vivienda pública ICAVI parque | Petición ley transparencia |
| VIV-04 | Precio alquiler por sección | Acuerdo Idealista o scraping legal |
| VIV-05 | Vivienda vacía detectada | Reconstrucción metodológica |
| VIV-06 | Suelo público disponible | Scraping municipal x 88 |
| SAL-05 | Casas mujer, salud mental peer | Sensibilidad publicación |
| SAL-06 | Cobertura cribados y vacunación | Pendiente fuente |
| CUL-04 | Programación cines/teatros viva | L por sede |
| CUL-06 | Capa fantasma antiguos cines | Proyecto memoria, requiere curación |
| TEJ-01 | Bancos del tiempo y monedas locales | Curación red |
| TEJ-02 | Centros sociales autogestionados | Ética: consentimiento centro a centro |
| TEJ-05 | Grupos cuidados peer | Curación + protección datos |
| TRA-02 | DIRCE empresas por epígrafe | INE granular limitado |
| PAR-03 | Plenos municipales actas | Un parser por ayuntamiento |
| PAR-06 | Declaraciones bienes cargos | Scraping pesado |
| PAR-10 | Convocatorias asambleas (crowdsourced) | Requiere Supabase live |
| DIG-04 | Equipamiento informático escuelas | Pendiente fuente |
| MEM-02 | Toponimia tradicional | Proyecto largo: oral history |
| MEM-03 | Heredamientos de agua | Trabajo archivo |
| MEM-04 | Yacimientos prehispánicos | Convenio Patrimonio (anti-expolio) |
| MEM-07 | Migración: pateras, embarque | Ética crítica |
| RIE-06 | Olas calor + escuelas críticas | Derivación |
| RIE-07 | Subida nivel mar IPCC Canarias | Reconstrucción |
| RIE-08 | Puntos encuentro emergencia | x municipio |

**Total Ola 3: 23 datasets**.

---

## 6. Auditoría de fuentes públicas (vivas en 2026)

Verificadas con WebFetch/WebSearch a fecha 2026-05-25:

| Fuente | Estado | URL | Notas |
|---|---|---|---|
| **datos.canarias.es** | **Vivo** | https://datos.canarias.es/portal/ | Activo en 2025/2026, cubrió IV Encuentro Nacional Datos Abiertos. Catalogación por tema/organización. |
| **datos.gob.es** | **Vivo** | https://datos.gob.es | Federa CAN. Estable. |
| **idecanarias.es** (GRAFCAN) | **Vivo** | https://www.idecanarias.es/ | ~200 servicios geográficos OGC. WMS/WFS de catalogo, ortofotos, planeamiento, calidad aire, redes geodésicas. Backbone IDEs Canarias. |
| **opendata.sitcan.es** | **Vivo** | https://opendata.sitcan.es | SITCAN — buen catálogo planeamiento, suelo, agricultura. |
| **ine.es** | **Vivo** | https://www.ine.es | Atlas ADRH 2023 publicado 2025-10-21. Sin datos 2024-2025 todavía. |
| **ISTAC** | **Vivo** | https://www.gobiernodecanarias.org/istac/datos-abiertos/ | API REST documentada (JSON, PC-Axis). e-Indicadores + e-Base. |
| **datos.tenerife.es** | **Vivo** | https://datos.tenerife.es | 284 datasets, fuerte en transporte (Titsa) y medio ambiente. CC-BY. |
| **santacruzdetenerife.es/opendata** | **Vivo** | https://www.santacruzdetenerife.es/opendata/dataset | 104 datasets. Datos electorales por mesa muy interesantes. |
| **datosabiertos.laspalmasgc.es** | **Vivo (cert SSL caducado)** | http://datosabiertos.laspalmasgc.es/ | Portal CKAN. Tiene Guaguas GTFS, planeamiento. Reportar cert a admin. |
| **transparencia.gobiernodecanarias.org** | **Vivo** | https://www.gobiernodecanarias.org/transparencia/ | Subvenciones, contratos, convenios. CSV/XLSX/PDF. |
| **infoelectoral.interior.gob.es** | **Vivo** | https://infoelectoral.interior.gob.es | Descargas oficiales todas las elecciones. TXT fixed-width. |
| **PLACSP** (contratación) | **Vivo** | https://contrataciondelestado.es/wps/portal/plataforma/datos_abiertos/ | Atom/XML. OpenPLACSP herramienta. |
| **catastro.hacienda.gob.es/webinspire** | **Vivo** | https://www.catastro.hacienda.gob.es/webinspire/ | ATOM por municipio. GML ETRS89. |
| **decide.laspalmasgc.es** | **Vivo** | https://decide.laspalmasgc.es | CONSUL. Presupuestos participativos 2025 activos (5 distritos, 3M€). API por verificar. |
| **calidadelaire/inicio.do (CEGCA)** | **Vivo** | https://www3.gobiernodecanarias.org/medioambiente/calidaddelaire/inicio.do | Estaciones actualizadas hora. |
| **AQICN Canarias** | **Vivo** | https://aqicn.org/map/canarias/es/ | API JSON estable. |
| **MITECO SNCZI inundaciones** | **Vivo** | https://www.miteco.gob.es/en/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html | WMS oficial. |
| **PEVOLCA La Palma Hub** | **Vivo** | https://riesgovolcanico-lapalma.hub.arcgis.com/ | ArcGIS REST. |
| **OSM Geofabrik canary-islands** | **Vivo y descargado** | local `public/GEOFABRIK/canary-islands-latest.osm.pbf` | Re-descargar mensual. |
| **TITSA GTFS oficial** | **Vivo** | http://www.titsa.com/Google_transit.zip | Update semanal. |
| **Guaguas Municipales GTFS** | **Vivo** | http://ckan.laspalmasgc.es/dataset/guaguas-municipales | Update semanal. |
| **Atlas Rural Gran Canaria** | **Vivo** | https://www.atlasruraldegrancanaria.com/ | Aliado potencial para ALI-03. |
| **Biblioteca de Canarias — Mapping Canarias** | **Vivo** | https://www.bibliotecadecanarias.org/recursos-digitales/mapping-canarias | Aliado potencial MEM-06. |

**Otros portales municipales a inspeccionar más adelante** (no auditados en profundidad aquí):

- Cabildo Gran Canaria — verificar si han abierto portal datos similar a TF.
- La Laguna, Telde, Arona, Adeje — los siguientes 4 en tamaño tras LPGC/SCT.
- Lanzarote y Fuerteventura — cabildos pequeños, expectativas modestas.
- La Gomera, El Hierro, La Palma — datos pueden ir vía GobCan únicamente.

---

## 7. Datos democráticos digitales — sección especial

Los datasets que **especialmente** activan el espacio democrático digital, con conexión concreta a POLIS:

### 7.1 Resultados electorales por sección (PAR-01)

- **Conexión visor**: pintar coropleta por partido dominante a nivel sección. Toggle entre Generales/Autonómicas/Municipales/Europeas. Histórico desde 2008.
- **Interacción cívica habilitada**:
  - Peek (hover sin tap): "tu sección · ultimas elecciones · partido más votado, abstención %, diferencia con media insular".
  - Tap: panel con histórico + cómo se vota tu mesa exacta + recordatorio próxima cita electoral.
  - Gesto cívico: "marcar mesa como pendiente de fiscalizar" para apoderados próxima cita.
- **Riesgo**: ninguno (datos públicos por mesa).

### 7.2 Presupuestos participativos LPGC (PAR-02)

- **Conexión visor**: capa "decisión activa" — distritos LPGC se iluminan cuando hay convocatoria abierta. Proyectos propuestos como pins, votables.
- **Interacción cívica**:
  - Peek: "tu distrito tiene X€ disponibles, Y proyectos en votación, plazo Z días".
  - Tap: deep link a decide.laspalmasgc.es con el proyecto pre-seleccionado.
- **Estado**: Pendiente confirmar API CONSUL expuesta o requerir scraping.
- **Impacto**: convierte un proceso del 1% de vecinos en un proceso visible para el 100%.

### 7.3 Plenos municipales — actas y votaciones nominales (PAR-03)

- **Conexión visor**: capa "agenda del pleno" — cada mes se actualiza con próximo pleno + puntos territorializados (¿qué punto afecta a qué barrio?).
- **Interacción cívica**:
  - Peek: "próximo pleno tu municipio: 12 jun · 5 puntos relacionados con tu distrito".
  - Tap: orden del día + acta del pleno anterior + asistencia + ¿cómo asistir presencial / streaming?
- **Riesgo**: 88 municipios con calidad publicación dispar → empezar por los 5 más grandes (LPGC, SCT, Telde, La Laguna, Arona).

### 7.4 Contratación pública PLACSP (PAR-04)

- **Conexión visor**: contratos georreferenciados al CIF del adjudicante (cuando se pueda) o al lugar de ejecución (cuando se declare).
- **Interacción cívica**:
  - Peek: "contrato de 250k€ por reforma plaza X, adjudicado a empresa Y, plazo 6 meses".
  - Tap: ficha PLACSP + comparativa con licitaciones previas mismo tipo (¿precio razonable?) + denuncia anomalías.
- **Esfuerzo backend**: parser Atom/XML diario filtrando por NUTS3 ES70 (Canarias).

### 7.5 Subvenciones GobCan + ayuntamientos (PAR-05)

- **Conexión visor**: pin por entidad beneficiaria, agrupable por barrio. Coropleta agregada por municipio (total subvencionado per cápita).
- **Interacción cívica**:
  - Peek: "X subvenciones recibidas por entidades de tu sección último año".
  - Tap: listado + filtro por tipo (deporte, cultura, social, etc.).

### 7.6 Declaraciones bienes cargos públicos (PAR-06)

- **Conexión visor**: ficha de cada cargo electo con vinculación territorial (alcalde/concejal por distrito en su caso).
- **Interacción cívica**: peek = "alcalde tu municipio · X declaraciones bienes desde elección · variación %"; tap = link declaraciones.
- **Esfuerzo**: alto (no hay homogeneización), pero impacto cívico alto.

### 7.7 Empleo público (TRA-03)

- **Conexión visor**: panel lateral "empleo público abierto" sin georeferenciación obligatoria, pero filtrable por administración.
- **Interacción cívica**: peek = "X plazas tu municipio + X plazas insulares + X autonómicas activas".

### 7.8 Consultas ciudadanas (PAR-08)

- **Conexión visor**: capa "decisión activa" análoga a PAR-02 pero para consultas no presupuestarias.
- **Interacción cívica**: peek = "consulta abierta sobre Plan X tu municipio, plazo Y"; tap = link a participar.

### 7.9 Iniciativas Legislativas Populares (PAR-09)

- **Conexión visor**: pin recogida firmas en localidad cuando esté activa.
- **Interacción cívica**: peek = "ILP activa sobre X recolectando firmas, mesa habilitada en tu barrio sábados"; tap = info + cómo firmar.

### 7.10 Convocatorias asambleas vecinales — crowdsourced (PAR-10)

- **Conexión visor**: nueva capa "agenda viva" alimentada por usuarios registrados con cursus honorum mínimo.
- **Interacción cívica**: peek = "asamblea AVV X mañana 19h plaza Y"; tap = ficha + RSVP + chat efímero (cuando esté el módulo social de POLIS).
- **Bloqueante**: requiere Supabase activo + tabla `convocatorias` + moderación.

---

## 8. Riesgos y consideraciones

### 8.1 Privacidad — datos que NO se muestran al detalle

- **Casas de acogida violencia género (SAL-05)**: nunca ubicación exacta. Solo "tu municipio tiene servicio + teléfono".
- **Yacimientos arqueológicos (MEM-04)**: nunca coordenada exacta. Buffer mínimo 500m. Riesgo expolio confirmado por arqueología canaria.
- **Lugares pateras y migración (MEM-07)**: nunca convertir personas en pin. Solo datos agregados por playa/año/cifra.
- **Servicios salud mental peer / grupos vulnerables (TEJ-05)**: solo con consentimiento explícito del grupo.
- **Centros sociales autogestionados (TEJ-02)**: solo si el propio centro decide aparecer.
- **Declaraciones bienes cargos (PAR-06)**: legal pero sensible — enlazar al portal oficial, no mirror.
- **Datos sanitarios individuales**: SCS no publica nada al detalle, y si lo hiciera no se reusa.

### 8.2 Fragilidad de fuentes

- **Cualquier scraping HTML** (web ayuntamiento) puede romperse en cualquier redesign. Documentar versión scraper.
- **Plataformas terceras** (Idealista, Fotocasa) cambian ToS sin aviso → no depender estructuralmente.
- **APIs no oficiales** (AQICN, parser GobCan AP) requieren plan B.
- **El certificado SSL caducado de datosabiertos.laspalmasgc.es** (constatado 2026-05-25) es síntoma: portales municipales pueden caerse por meses sin mantenimiento. Cachear local + alertar.
- **CONSUL API** depende de versión instancia. LPGC puede no estar actualizada — confirmar.

### 8.3 Datasets que requieren acuerdo institucional

- **Vivienda pública ICAVI** (VIV-02): solicitud ley transparencia, ~1-3 meses.
- **Yacimientos arqueológicos** (MEM-04): convenio Consejería Patrimonio.
- **Carta arqueológica detallada**: nunca pública, requiere convenio con NDA.
- **Servicios sociales detallados**: solicitud formal a cada cabildo.
- **Plenos municipales sistematizados**: idealmente convenio con FECAM (Federación Canaria Municipios).
- **Heredamientos de agua** (MEM-03): trabajo de archivo con Heredades existentes.

### 8.4 Datasets que requieren crowdsourcing

- **Patrimonio inmaterial** (CUL-02): vecindario, mayores del barrio, asociaciones culturales.
- **Toponimia tradicional** (MEM-02): historia oral, requiere voluntarios con grabadora.
- **Capa fantasma cines/casinos antiguos** (CUL-06): hemeroteca + memoria viva.
- **Asambleas vecinales** (PAR-10): comunidad POLIS auto-aporta.
- **Huertos urbanos** (ALI-02): los propios huertos se autodeclaran.
- **AMPAS** (TEJ-03): las propias AMPAS confirman datos.

Para todo crowdsourcing: política de **doble validación** (un usuario propone, dos validan o un didáskalos del cursus aprueba). Coherente con doctrina KOINOS.

### 8.5 Consideraciones técnicas transversales

- **Reproyección**: Canarias hace agnóstico el huso. ETRS89 / WGS84 todo el catastro, pero al pintar en visor reproyectar a Web Mercator EPSG:3857 (o el sistema isométrico custom). Documentar pipeline.
- **Coste storage**: catastro Canarias ~1.48M edificios + ~0.7M parcelas. Tile + simplificación obligados.
- **Update cadence**: definir por dataset (ver tabla §6). No re-descargar todo cada deploy.
- **Licencias**: priorizar CC-BY. Documentar atribución de cada dataset visible en el visor (pie de página "Fuentes").

---

## 9. Recomendación final: los tres datasets para esta semana

De los 12 de la Ola 1, estos son los **tres de mayor ratio impacto/esfuerzo** para arrancar ya:

### #1 — TRA-01 · Paro registrado por municipio (ISTAC)

- **Esfuerzo**: XS — una llamada API a `https://datos.canarias.es/api/estadisticas/...` y CSV directo en `https://opendata.gobiernodecanarias.org/dataset/activity/paro-registrado-por-municipios-actualizados`.
- **Impacto**: Crítico — cruza con `renta` y da el indicador socioeconómico más demandado.
- **Pipeline propuesto** (no implementar, solo esbozar):
  1. Descargar CSV mensual ISTAC paro registrado.
  2. Normalizar municipio → codmun INE.
  3. Crear `public/data/paro-municipio.json` análogo a `renta-municipio.json`.
  4. Crear `overlays/paro.js` copy de `overlays/renta.js` (mismo estilo coropleta).
  5. Añadir al index.js. Categoría "desigualdades".
- **Tiempo estimado**: 1-2h end-to-end.

### #2 — ESP-03 · Calidad del aire tiempo real (AQICN proxy)

- **Esfuerzo**: S — JSON estable.
- **Impacto**: Crítico — primer dato "vivo" del visor (no histórico). Cambia la sensación.
- **Pipeline propuesto**:
  1. Identificar las ~12-15 estaciones CEGCA en Canarias vía AQICN (`https://aqicn.org/city/las-palmas-de-gran-canaria/es/` y similares).
  2. Para cada estación, AQICN expone JSON con ICA + contaminantes + última actualización.
  3. Proxy server-side (evitar CORS + ocultar key si la requiere) cacheado 15 min.
  4. `overlays/aire.js` pinta puntos coloreados por ICA. Categoría "ambiente".
  5. Peek: nombre estación + ICA + contaminante peor.
  6. Tap: histórico 24h + qué hacer si >100.
- **Tiempo estimado**: medio día. Es la capa que más impacta porque introduce **tiempo real**.

### #3 — PAR-05 · Subvenciones GobCan concedidas

- **Esfuerzo**: S — CSV directo en `https://datos.canarias.es/catalogos/general/dataset/subvenciones-premios-y-becas-del-gobierno-de-canarias/resource/f988d0ba-9bc5-4d4a-93ec-cf567f971d34`.
- **Impacto**: Alto — primer dataset democrático visible. Activa la sensación "esto sí es ventanilla cívica".
- **Pipeline propuesto**:
  1. Descargar CSV semestral.
  2. Cruzar beneficiario (NIF/CIF) con `tejido-social.geojson` ya curado y con `registro-oficial` para georreferenciar.
  3. Los que no matchean → agregar por municipio del beneficiario si está.
  4. `overlays/subvenciones.js` pinta pins en sedes asociaciones + coropleta total por municipio.
  5. Peek: "X subvenciones tu barrio total Y€"; tap: listado año.
- **Tiempo estimado**: medio día - 1 día.

**Argumento estratégico de estos tres**: paro (TRA-01) y calidad aire (ESP-03) tocan el cuerpo del vecino (mi precariedad, mi respirar); subvenciones (PAR-05) toca su voz cívica (mi dinero público). Los tres juntos dicen "este visor te informa, te cuida y te empodera" en una sola sesión de uso.

---

## 10. Cómo se usa este documento

Si eres el próximo chat / agente / Pancho mismo retomando esto:

### 10.1 Qué hay validado a 2026-05-25

- **Fuentes vivas** en §6 todas verificadas con WebFetch o WebSearch este día.
- **Inventario overlays existentes** en §2 leído de `/Users/panch/KOINOS-iso/public/polis-app/overlays/index.js`.
- **Las 3 prioridades de §9** llevan pipeline esbozado pero **NO implementado** (restricción explícita del usuario).

### 10.2 Qué falta validar antes de implementar

- **CONSUL API decide.laspalmasgc.es**: ver si `https://decide.laspalmasgc.es/api/v1/` responde. Si sí, PAR-02 sube a Ola 1. Si no, escalar a Ola 2 con scraping.
- **GobCan Sanidad SCS endpoints reales** para centros AP (SAL-01): puede haber API no documentada en `www3.gobiernodecanarias.org/sanidad/`.
- **Catastro ATOM municipio por municipio**: para Canarias hay que iterar sobre 88 municipios. Hay scripts QGIS plugin existentes (Spanish Inspire Catastral Downloader).
- **Estado portal LPGC SSL caducado**: reportar a `info@laspalmasgc.es` o usar URLs `http://` con disclaimer.
- **TF: portal datos.tenerife.es ya inventariado** (284 datasets) pero falta cruzar qué subset ya estamos usando vs qué falta.

### 10.3 Archivos del codebase relevantes

| Path | Por qué interesa |
|---|---|
| `/Users/panch/KOINOS-iso/public/polis-app/overlays/index.js` | Registry overlays. Cualquier capa nueva se enchufa aquí. |
| `/Users/panch/KOINOS-iso/public/polis-app/overlays/renta.js` | Patrón coropleta municipal. Copy para TRA-01. |
| `/Users/panch/KOINOS-iso/public/polis-app/overlays/lista-espera.js` | Patrón puntos georreferenciados. Copy para SAL-* y ESP-03. |
| `/Users/panch/KOINOS-iso/public/polis-app/overlays/eventos.js` | Patrón pins con timestamps + popups ricos. Copy para PAR-08, PAR-10. |
| `/Users/panch/KOINOS-iso/public/polis-app/overlays/registro.js` | Patrón overlay context-aware con lazy-load por isla. Copy para PLACSP y subvenciones. |
| `/Users/panch/KOINOS-iso/public/data/` | Datasets ya descargados, formato canónico (mun, sección, GeoJSON, JSON). |
| `/Users/panch/KOINOS-iso/public/sections_pack/{cusec}/` | Geometría secciones censales. Crítico para cualquier coropleta a nivel sección. |
| `/Users/panch/KOINOS-iso/public/GEOFABRIK/canary-islands-latest.osm.pbf` | Fuente OSM completa. Re-descargar mensual con script. |
| `/Users/panch/KOINOS-iso/docs/STYLE_GUIDE.md` | Estilo visual canónico — toda capa debe pasar por aquí. |
| `/Users/panch/KOINOS-iso/docs/CURATION-POLICY.md` | Política curación tejido social — extrapolable a todos crowdsourced. |
| `/Users/panch/KOINOS-iso/docs/IDEAS.md` | Decisiones acumuladas del flow Pancho — leer antes de proponer cambios estructurales. |
| `/Users/panch/KOINOS-iso/POLIS-ISO-STATE.md` | Estado del worktree iso. Leer SIEMPRE antes de tocar nada en `polis-app/`. |

### 10.4 Convenciones repetidas en overlays existentes

Si vas a añadir overlay nuevo, sigue el patrón:

1. `id` slug en `kebab-case` ("paro-registrado", "calidad-aire", "subvenciones").
2. `name` corto castellano ("Paro", "Aire", "Subvenciones").
3. `load(state)` idempotente con cache propio.
4. `isReady()` boolean.
5. `draw(ctx, state, view)` consulta `state.lodLevel` para decidir qué dibujar.
6. Categoría en `META` en `index.js` siguiendo CATEGORIES existentes.
7. Niveles en `META` (`isla`, `municipio`, `distrito`, `barrio`, `seccion`, `manzana`).

### 10.5 Decisión política pendiente

Las capas **PAR-*** (participación democrática) y **MEM-*** (memoria) llevan **carga política** mayor que las técnicas (movilidad, vivienda). Antes de desplegar PAR-01 (electorales) a producción, conviene revisar con Pancho:

- ¿Coropleta partido dominante o ranking visible? La primera puede sentirse polarizadora; la segunda más neutra.
- ¿Histórico desde cuándo? 1977 da contexto democrático completo pero puede ser ruidoso. 2011 alcanza con todas las nuevas formaciones.
- ¿Se permite filtrar por candidatura o solo agregados PSOE/PP/CC/NC/Vox/Sumar? Filtrado fino abre debate distinto.

Y para MEM-01 (memoria democrática): respeto absoluto al protocolo del Ministerio. Cada lugar lleva ficha del Ministerio + enlace, no relato propio.

### 10.6 Si el documento queda obsoleto

Re-auditar §6 cada 6 meses (los portales municipales son los más frágiles). Actualizar §2 cada vez que se merge un overlay nuevo. Re-priorizar §5 cuando se cierre algún bloqueante de Ola 2/3.

---

## Apéndice A — Conteo total

- **Categorías**: 13.
- **Datasets propuestos**: 67.
- **Por categoría**:
  - Movilidad sostenible: 6
  - Vivienda y derecho a la ciudad: 7
  - Salud y cuidados: 6
  - Educación a lo largo de la vida: 6
  - Cultura, ocio y patrimonio: 6
  - Alimentación soberana: 5
  - Espacio público, naturaleza y clima: 7
  - Tejido social y cuidados comunitarios: 6
  - Trabajo y economía local: 5
  - Participación democrática: 10
  - Brecha digital y derecho al acceso: 4
  - Memoria histórica e identidad canaria: 7
  - Riesgos ambientales y resiliencia: 8
- **Por ola**:
  - Ola 1 (próximas 2 semanas): 12 datasets
  - Ola 2 (1-2 meses): 32 datasets
  - Ola 3 (3-6 meses+): 23 datasets
- **Sumando**: 67 totales (con un par que pueden moverse entre olas según valida CONSUL API y otras incógnitas).

---

## Apéndice B — Glosario rápido

- **ADRH**: Atlas de Distribución de Renta de los Hogares (INE, anual, por sección censal).
- **CEGCA**: Centro de Evaluación y Gestión de la Calidad del Aire (GobCan).
- **CONSUL**: software open source de participación ciudadana usado por LPGC y muchos ayuntamientos.
- **CUSEC**: código sección censal INE (10 dígitos: prov + mun + distrito + sección).
- **FECAM**: Federación Canaria de Municipios.
- **GTFS**: General Transit Feed Specification.
- **ICAVI**: Instituto Canario de la Vivienda.
- **ICA**: Índice Calidad del Aire.
- **IDECanarias**: Infraestructura de Datos Espaciales de Canarias (GRAFCAN).
- **INSPIRE**: directiva europea de infraestructuras de datos espaciales.
- **ISTAC**: Instituto Canario de Estadística.
- **PEMU**: Plan de Emergencia Municipal.
- **PEVOLCA**: Plan Especial Protección Civil Riesgo Volcánico Canarias.
- **PGOU**: Plan General de Ordenación Urbana.
- **PLACSP**: Plataforma Contratación Sector Público.
- **SAIH**: Sistema Automático Información Hidrológica.
- **SCS**: Servicio Canario de Salud.
- **SITCAN**: Sistema Información Territorial Canarias.
- **SNCZI**: Sistema Nacional Cartografía Zonas Inundables.

---

*Fin del roadmap. Para retomar, leer §10 antes de cualquier acción.*
