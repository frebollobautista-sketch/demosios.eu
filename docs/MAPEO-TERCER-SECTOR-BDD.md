# Mapeo de fuentes · BDD de entidades no empresariales

> Inventario de registros y fuentes públicas para alimentar una base de datos
> de entidades del **tercer sector** y agrupaciones cívicas en Canarias
> (asociaciones, fundaciones, partidos políticos, sindicatos, cooperativas,
> comunidades religiosas, federaciones vecinales, etc.).
> Última revisión: 13 mayo 2026.

---

## 0 · Esquema unificado propuesto

Campos comunes a poblar para cada entidad, independientemente del registro
de origen. Permite cruzar e identificar duplicados.

| Campo                | Tipo     | Notas                                                             |
|----------------------|----------|-------------------------------------------------------------------|
| `entity_id`          | uuid     | identificador interno KOINOS                                      |
| `nombre`             | text     | denominación oficial                                              |
| `nombre_normalizado` | text     | lower, sin tildes, sin "asociación de…" — clave de matching       |
| `tipo`               | enum     | asociación · fundación · partido · sindicato · cooperativa · religiosa · federación · cofradía · colegio profesional · colectivo informal |
| `subtipo`            | enum     | juvenil · de mayores · de vecinos · cultural · deportiva · ONGD · ecologista · LGTBI+ · discapacidad · vivienda · etc. |
| `ámbito`             | enum     | estatal · autonómico · insular · municipal · barrio                |
| `registro_origen`    | enum     | clave del registro de procedencia (ver tabla §1-§3)                |
| `numero_registro`    | text     | número en el registro original                                    |
| `fecha_constitución` | date     | si se conoce                                                       |
| `cif`                | text     | clave fuerte de deduplicación                                     |
| `dirección`          | text     | tal como conste                                                    |
| `lng`, `lat`         | float    | geocodificada                                                     |
| `barrio`             | text     | unir con `polis-secciones.json`                                    |
| `cusec`              | text(10) | sección censal — derivada por point-in-polygon                    |
| `web`                | url      |                                                                    |
| `email`, `teléfono`  | text     |                                                                    |
| `temáticas`          | text[]   | etiquetado libre — ver §5                                          |
| `estado`             | enum     | activa · inactiva · suspendida · baja                              |
| `fuente_url`         | url      | ficha en el registro original                                      |
| `fecha_extraccion`   | date     |                                                                    |
| `validada`           | bool     | true cuando un humano la revisa                                    |

Reglas de deduplicación, en orden:

1. coincidencia exacta de `cif`
2. coincidencia exacta de `numero_registro` + `registro_origen`
3. `nombre_normalizado` + (mismo `barrio` o misma `provincia`)
4. resto: candidata manual

---

## 1 · Registros estatales

Útiles para entidades de ámbito nacional con sede en Canarias y para enriquecer
fichas (ej. fundaciones que aparecen también en el registro autonómico).

### 1.1  Registro Nacional de Asociaciones (RNA)

- **Organismo**: Ministerio del Interior · DG de Política Interior
- **Cobertura**: asociaciones de ámbito estatal o supra-autonómico
- **URL**: https://sede.mir.gob.es/ · Servicios al ciudadano → Registro Nacional de Asociaciones
- **Acceso**: consulta gratuita por número de registro o denominación. No hay descarga masiva publicada; toca scraping educado o solicitud al Portal de Transparencia.
- **Volumen aproximado**: 300.000+ asociaciones a nivel nacional
- **Campos**: denominación · CIF · fecha alta · domicilio · ámbito territorial · fines
- **Notas**: la mayoría de asociaciones vecinales NO están aquí (van en el autonómico). Buscar aquí: federaciones, plataformas estatales, ONGD grandes.

### 1.2  Registro de Partidos Políticos

- **Organismo**: Ministerio del Interior · DG de Política Interior
- **Cobertura**: partidos, federaciones, coaliciones y agrupaciones de electores
- **URL**: https://servicio.mir.es/nfrontal/webpartido_politico.html
- **Acceso**: consulta abierta por denominación. Lista descargable parcial.
- **Campos**: denominación · siglas · fecha inscripción · domicilio · representantes · estado
- **Notas**: incluye los registrados aunque no hayan concurrido a elecciones. Agrupaciones de electores quedan inscritas por la JEC, no aquí.

### 1.3  Registro de Fundaciones de Competencia Estatal

- **Organismo**: Ministerio de Cultura (Protectorado Único de Fundaciones desde 2015)
- **Cobertura**: fundaciones con actividad en más de una CCAA
- **URL**: https://www.cultura.gob.es/cultura/areas/fundaciones.html
- **Acceso**: buscador online + memorias anuales obligatorias en PDF
- **Campos**: denominación · CIF · sede · fines · patronato · cuentas anuales

### 1.4  Estadística de Asociaciones Sindicales

- **Organismo**: Ministerio de Trabajo · Depósito de Estatutos
- **URL**: https://expinterweb.mites.gob.es/depesta/
- **Acceso**: consulta por denominación. Permite descarga de estatutos.
- **Cobertura**: sindicatos y asociaciones empresariales (filtrar empresarial fuera)
- **Notas**: el registro es por provincia. Las Palmas tiene su propio depósito.

### 1.5  Registro Nacional de Sociedades Cooperativas

- **Organismo**: Ministerio de Trabajo y Economía Social
- **URL**: https://www.mites.gob.es/es/sec_trabajo/autonomos/economia-soc/EconomiaSocial/registros/index.htm
- **Cobertura**: cooperativas de ámbito estatal (la mayoría están en el autonómico §2.6)

### 1.6  Registro de Entidades Religiosas (RER)

- **Organismo**: Ministerio de Presidencia · DG de Libertad Religiosa
- **URL**: https://maper.mjusticia.gob.es/Maper/RER.action
- **Acceso**: buscador público por denominación, confesión, municipio
- **Cobertura**: iglesias, parroquias, comunidades evangélicas, mezquitas, sinagogas, comunidades budistas, etc.
- **Campos**: denominación · confesión · domicilio · número RER · entidad principal
- **Volumen Canarias estimado**: ~600 entidades
- **Notas**: la Iglesia católica tiene cada parroquia como entidad propia.

### 1.7  Plataforma del Tercer Sector (agregador)

- **URL**: https://www.plataformatercersector.es/
- **Uso**: directorio cruzado de las grandes organizaciones del tercer sector estatal con presencia autonómica. No es registro oficial; sirve de checklist.

---

## 2 · Registros autonómicos (Canarias)

Núcleo principal de la BDD — la mayoría de entidades vecinales y locales
están aquí, no en los registros estatales.

### 2.1  Registro de Asociaciones de Canarias

- **Organismo**: Consejería de Presidencia, Justicia y Diversidad
- **URL**: https://www.gobiernodecanarias.org/justicia/asociaciones/
- **Acceso**: consulta por denominación, CIF, número de registro. La descarga masiva no está abierta — pedir vía Portal de Transparencia o scraping respetuoso.
- **Cobertura**: ~25.000 asociaciones en Canarias (estimación)
- **Subtipos relevantes**:
  - generales · culturales · vecinales · ecologistas · LGTBI+ · de mujeres · inmigración · discapacidad · memoria histórica
- **Campos**: denominación · CIF · fecha alta · domicilio · ámbito · objeto social · junta directiva (última conocida)
- **Notas**: muchísimas asociaciones figuran como "activas" pero llevan años inoperativas; cruzar con presencia web/redes para depurar.

### 2.2  Registro Canario de Fundaciones

- **Organismo**: Consejería de Presidencia
- **URL**: https://www.gobiernodecanarias.org/presidencia/fundaciones/
- **Cobertura**: fundaciones con actividad principal en Canarias
- **Campos**: denominación · CIF · sede · patronato · fines · cuentas anuales (PDF)
- **Volumen**: ~400 fundaciones

### 2.3  Censo de Entidades Juveniles de Canarias

- **Organismo**: Consejería de Educación · Dirección General de Juventud
- **URL**: https://www3.gobiernodecanarias.org/educacion/web/juventud/
- **Cobertura**: asociaciones juveniles, secciones juveniles de otras asociaciones, consejos locales de la juventud, casas de juventud
- **Campos**: denominación · ámbito · domicilio · responsable

### 2.4  Registro Canario de Entidades de Voluntariado de Acción Social

- **Organismo**: Consejería de Bienestar Social
- **URL**: https://www.gobiernodecanarias.org/bienestarsocial/temas/voluntariado/
- **Cobertura**: entidades que canalizan voluntariado social
- **Notas**: hay solapamiento con el registro general de asociaciones; este registro habilita para subvenciones específicas.

### 2.5  Censo de Agentes de Cooperación Internacional / ONGD

- **Organismo**: Consejería de Bienestar Social · Cooperación
- **URL**: https://www.gobiernodecanarias.org/bienestarsocial/temas/cooperacion/
- **Cobertura**: ONGD con sede o delegación en Canarias
- **Campos**: denominación · áreas geográficas · áreas temáticas · presupuesto anual · contrapartes

### 2.6  Registro de Cooperativas de Canarias

- **Organismo**: Consejería de Economía, Industria, Comercio y Autónomos
- **URL**: https://www.gobiernodecanarias.org/empleo/temas/economiasocial/
- **Cobertura**: cooperativas de trabajo, consumo, vivienda, agrarias, enseñanza, etc.
- **Filtro**: descartar cooperativas de trabajo asociado de fines puramente lucrativos si se quiere mantener el corte "no-empresarial"; mantener las de consumo, vivienda y enseñanza.

### 2.7  Registro de Sociedades Laborales de Canarias

- **Mismo organismo que 2.6**
- **Notas**: dudoso si incluir — son sociedades de capital con mayoría obrera, no tercer sector estricto. Sugerencia: campo `tipo = sociedad_laboral` con flag `tercer_sector = false`.

### 2.8  Registro de Entidades Deportivas de Canarias

- **Organismo**: Consejería de Educación · Dirección General de Deportes
- **URL**: https://www.gobiernodecanarias.org/deportes/
- **Cobertura**: clubes, federaciones insulares y canarias, secciones deportivas de asociaciones
- **Volumen**: ~3.500 clubes
- **Notas**: capa rica para ámbito de barrio (luchadas, fútbol, ajedrez, surf, etc.).

### 2.9  Registro de Centros y Servicios Sociales

- **Organismo**: Consejería de Bienestar Social
- **Cobertura**: residencias, centros de día, centros ocupacionales, viviendas tuteladas
- **Notas**: incluye centros gestionados por asociaciones y fundaciones — cruzar con 2.1 y 2.2.

### 2.10  Registro de Centros Sociosanitarios y de Salud Mental

- **Organismo**: Servicio Canario de la Salud
- **Cobertura**: incluye dispositivos gestionados por entidades sin ánimo de lucro

---

## 3 · Registros municipales (Las Palmas de Gran Canaria · proyecto piloto)

### 3.1  Registro Municipal de Entidades Ciudadanas (RMEC)

- **Organismo**: Ayuntamiento de LPGC · Servicio de Participación Ciudadana
- **URL**: https://www.laspalmasgc.es/es/ayuntamiento/areas-de-gobierno/participacion-ciudadana/
- **Cobertura**: AAVV, asociaciones culturales y deportivas, AMPAS, comisiones, plataformas con sede en LPGC. Inscripción voluntaria pero condición para subvenciones municipales.
- **Campos**: denominación · CIF · sede · presidencia · objeto · distrito · contacto · número RMEC
- **Volumen**: ~1.800 entidades (orden de magnitud)
- **Acceso**: petición formal al servicio · existe un listado público parcial · idealmente pedir export en CSV.
- **Notas**: la pieza más útil para POLIS porque trae **distrito** y a menudo **dirección** ya geocodificable. Para el piloto Suárez Naranjo es el registro de referencia.

### 3.2  Federación de Asociaciones de Vecinos

- **Cobertura**: federaciones de AAVV de LPGC (Faro, Telde tiene la suya, etc.)
- **Acceso**: contacto directo. Mantienen su propio directorio interno.
- **Notas**: vía rápida para curar el subtipo "AAVV" del registro autonómico (§2.1).

### 3.3  Consejos sectoriales municipales

Cada consejo tiene su composición publicada (entidades miembros). Convertir
la composición en un set de fichas confirma cuáles están activas.

- Consejo Municipal de la Mujer
- Consejo Municipal de Personas Mayores
- Consejo Municipal de Juventud
- Consejo Municipal de Cooperación al Desarrollo
- Consejo de la Discapacidad
- Consejo Sectorial LGTBI+
- Consejo Económico y Social

### 3.4  Comisión Organizadora del Carnaval

- **Organismo**: Ayuntamiento LPGC · Cultura
- **Cobertura**: comparsas, murgas, batucadas, agrupaciones de disfraces inscritas en el carnaval
- **Notas**: muchas no figuran como asociación formal pero son entidades cívicas potentes; incluir con `tipo = colectivo_carnaval`.

### 3.5  Comisiones de fiestas vecinales

- Comisión de Fiestas de Las Canteras, San Juan en Telde, Bajada de la Rama (Agaete), etc.
- **Acceso**: descentralizado por barrio. Catalogación manual mediante búsqueda en notas de prensa locales y en convocatorias de subvención.

### 3.6  AMPAS

- **Organismo**: Consejería de Educación (registro autonómico) + ayuntamientos
- **Cobertura**: una por colegio público o concertado activa
- **Notas**: cruzar con el listado de centros educativos de la Consejería de Educación.

---

## 4 · Categorías que escapan a los registros formales

Importantes para no quedarse solo con la "foto burocrática" del tejido cívico.
Habría que catalogarlas con métodos mixtos (notas de prensa, RRSS, trabajo
de campo).

| Categoría                     | Fuentes posibles                                   |
|-------------------------------|----------------------------------------------------|
| Hermandades y cofradías       | Diócesis de Canarias (parroquias); medios locales  |
| Comunidades de propietarios   | Catastro · administradores de fincas               |
| Plataformas informales (PAH, Stop Desahucios, etc.) | RRSS · notas de prensa     |
| Centros culturales independientes | Programación cultural · agendas locales        |
| Espacios autogestionados      | Convocatorias propias · contactos directos         |
| Comparsas / murgas no registradas | Listas oficiales del carnaval (§3.4)           |
| Comisiones vecinales sin estatuto | Actas municipales · prensa de barrio           |
| Grupos de WhatsApp / Telegram cívicos | Imposible mapear sistemáticamente. Documentar dónde sea visible. |

---

## 5 · Taxonomía temática transversal (etiquetado libre)

Cada entidad puede llevar 1-N etiquetas. Permite la mecánica de filtros del
visor (estilo `mock_servicios.png`).

```
cultura · educación · educación-adultos · mayores · juventud · mujer
LGTBI+ · inmigración · racialización · diversidad-funcional · salud-mental
salud · vecinal · vivienda · movilidad · ciclismo · ecologismo · clima
patrimonio · memoria-histórica · lengua-canaria · identidad-canaria
deporte · ajedrez · luchadas · fútbol · surf
carnaval · fiestas-vecinales · gastronomía
cooperación-internacional · derechos-humanos · paz
religiosa · espiritual · interreligioso
política · agrupación-electoral · sindical
profesional · colegio-profesional · consumidores
tercer-sector · voluntariado
```

---

## 6 · Plan de ingesta sugerido (prioridad → coste)

| Pri | Fuente                                            | Coste     | Cobertura para piloto |
|-----|---------------------------------------------------|-----------|-----------------------|
| 1   | RMEC LPGC (§3.1)                                  | bajo      | crítica para Suárez Naranjo |
| 2   | Federación de AAVV LPGC (§3.2)                    | bajo      | enriquece subtipo "vecinal" |
| 3   | Registro de Asociaciones de Canarias (§2.1)       | medio (scraping respetuoso o solicitud transparencia) | base de todo |
| 4   | Registro Canario de Fundaciones (§2.2)            | medio     | añade fundaciones grandes |
| 5   | Registro de Entidades Religiosas (§1.6)           | bajo      | parroquias y comunidades |
| 6   | Registro de Entidades Deportivas (§2.8)           | bajo      | aporta vida de barrio |
| 7   | Censo Juventud (§2.3)                             | bajo      | colectivos jóvenes     |
| 8   | Cooperativas (§2.6)                               | medio     | filtrar tercer sector  |
| 9   | Registro de Partidos Políticos (§1.2)             | bajo      | agrupaciones locales   |
| 10  | Consejos sectoriales (§3.3)                       | bajo      | curado de activas      |
| 11  | ONGD (§2.5)                                       | bajo      | cooperación            |
| 12  | Carnaval / fiestas (§3.4 §3.5)                    | medio-alto| manual                 |
| 13  | Plataformas informales (§4)                       | alto      | continuo               |

---

## 7 · Consideraciones legales

- **LOPDGDD / RGPD**: los registros públicos publican `denominación`, `CIF` y `domicilio` legalmente. Datos de personas físicas (presidencias, juntas directivas) **NO** se redistribuyen sin base legal — quedan fuera de la BDD pública.
- **Reutilización (Ley 37/2007 modificada por Ley 18/2015)**: si un registro publica datos, son reutilizables citando fuente. Conviene loguear `fuente_url` y `fecha_extraccion`.
- **Robots y scraping**: respetar `robots.txt`, throttling, y la doctrina del CENDOJ sobre webs públicas. Mejor pedir export oficial.

---

## 8 · Próximo paso técnico

1. Crear tabla `entities` en Supabase con el esquema §0.
2. Crear tablas auxiliares `entity_categories` (M:N para taxonomía §5) y
   `entity_sources` (rastrea por dónde llegó cada ficha).
3. Empezar el primer importador: `scripts/ingest_rmec_lpgc.mjs` con un CSV
   o scraping puntual del listado público del RMEC, geocodificando con
   Nominatim contra `polis-secciones.json` para asignar `cusec`.
4. Definir la regla "mostrar solo si `validada = true` o si la fuente es
   institucional" para que la BDD no se rellene de fichas zombi.
