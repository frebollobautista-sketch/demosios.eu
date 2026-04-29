# Análisis cruzado NODOS ↔ Demos iOS

Lectura del expediente completo de NODOS Culturales (Lima Centro, 2026 — postulación al Fondo DemocráTICa II) y propuesta de qué traer, qué ofrecer y dónde encajan los dos proyectos.

Última revisión: 2026-04-29.

---

## 1. Qué es NODOS

Plataforma de **cartografía cultural participativa** del consorcio Nodos Culturales (Lima Metropolitana, Perú). Llevan 5 años (2021-2026) mapeando ecosistemas culturales por zonas — Lima Centro, Norte, Sur, Este, Comas. Hoy publican sus mapas como Google My Maps embebidos en `/cartografiaculturaldelima` (~140k visualizaciones acumuladas) y migran a una **plataforma propia** con MVP previsto para junio 2026.

Postulación al Fondo DemocráTICa II con presupuesto USD 3 300 dividido en dos contratos:

- **Casanova/Ascencio/Ramírez** (USD 1 580): desarrollo end-to-end del MVP en 6 semanas. Stack: WordPress/Avada/PHP 8.4 sobre Dreamhost, Google Maps API.
- **Tomy Tomas / Future Robot** (USD 1 700): consultoría de gamificación y roadmap, 8 semanas. Cuatro entregables documentales, sin código.

El propio Pancho está dentro del proceso como asesor — en `Nodos v0.1` hay un análisis suyo que ya destripa ambas propuestas (con razón) y propone reacomodos. Tiene además un v0.2 funcional: **React + Vite + TypeScript + Tailwind**, con **371 espacios reales**, **16 polígonos de distrito extraídos de OSM**, calles indexadas, búsqueda, ContributeModal en 3 pasos, proyección equirrectangular invertible, Zustand. Es decir: el "MVP" que iba a contratar a Casanova **Pancho ya lo tiene casi hecho de su mano**.

## 2. Lo que sorprende: NODOS está más maduro técnicamente que muchos consorcios

A diferencia del enunciado del usuario ("cero experiencia de implementación digital"), lo que hay en disco es bastante:

- **Datos limpios y proyectados**: 371 espacios con los 4 ejes de caracterización, 16 distritos OSM con función de proyección invertible, 6 813 calles indexadas con autocomplete.
- **Stack moderno**: React 18 + Vite + TypeScript + Tailwind + Zustand, pan/zoom propio a 60 fps, separación clara de capas.
- **Iconografía consistente**: pins coral/ámbar derivados del PDF de la Cartografía Cultural 2025.
- **Marco teórico explícito**: Harley, Freire, De Sousa Santos, Iconoclasistas, Duxbury — citados en `04_metodologia_categorias_nodos.md`. No es decorativo: estructura el modelo de datos.

La carencia "digital" parece ser más bien **de la organización Nodos Culturales** que del expediente de Pancho. NODOS *como organización* sigue dependiendo de Google My Maps y va a contratar fuera para construir su MVP. NODOS *como expediente del v0.1+v0.2 de Pancho* está casi listo.

## 3. La metodología es excepcional — y es lo más absorbible

Lo más valioso para Demos iOS no son los mapas ni el código sino el **marco metodológico**. Ver `Nodos v0.1/00_analisis/04_metodologia_categorias_nodos.md` línea por línea. Tres conceptos clave que faltan en Demos iOS:

### 3.1 Tres ontologías mapeables

Hoy en Polis solo modelamos **espacios** (bloques con composición de capital). NODOS demuestra que un mapeo cultural rico necesita tres tipos de objetos:

| Ontología | En Demos iOS hoy | Equivalente NODOS | Lo que falta |
|---|---|---|---|
| **Espacios** (lugares con coordenada fija) | `bloques`/`edificios` con composición de capital | `espacios.json` con 4 ejes | Bien cubierto |
| **Agentes** (personas/colectivos/organizaciones) | Implícito en `profiles` + cursus honorum | `agents.json` (schema documentado) | Falta tabla de **colectivos** distinta de usuarios — un colectivo no es un usuario, es una entidad cívica |
| **Prácticas** (eventos/rituales/dinámicas) | Inexistente | `practices.json` con tipos `ritual_festivo \| feria \| pasacalle \| taller_recurrente` | Falta toda esta capa |

Las **prácticas** son lo más urgente de absorber: una asamblea vecinal, un mercado de productores, una romería, una jornada de limpieza de costa, una fiesta patronal. **No son espacios** porque su lugar varía (yunzas en Comas: misma fiesta, distinto cruce de calles cada año). **No son agentes** porque ocurren, no existen como entidad permanente. **Son lo que une el común a lo público real**.

### 3.2 Provenance / trazabilidad

Cada registro en NODOS lleva dos campos que en Demos iOS no existen:

- `metodo_captura: presencial | virtual | itinerante | redes` — cómo se recogió el dato.
- `proyecto_cartografico: lima-centro-2021 | comas-2026 | …` — en qué ciclo/taller fue mapeado.

Esto resuelve un problema que tenemos sin formular en `contribuciones`: hoy un PEC de un usuario y un import masivo de catastro pesan igual. Con `metodo_captura` distinguiríamos confiabilidad. Con `proyecto_cartografico` — o en nuestro lenguaje, `cohorte` o `taller` — podríamos decir "los datos del barrio Vegueta son de octubre 2026, los de San Cristóbal de marzo 2027".

### 3.3 Cuatro ejes de caracterización

Los aplican a espacios culturales, pero la lógica se traslada a Polis con otra dirección. NODOS pregunta:

| Eje NODOS (cultural) | Equivalente Demos iOS (cívico) |
|---|---|
| Tipo de espacio (local vs alternativo vs público) | Tipo de bloque (común vs residente vs autónomo vs rentista vs corporativo) — **ya lo tenemos** |
| Manifestaciones (plástica/audiovisual/performativa/literaria, multi) | Usos del bloque (vivienda/comercio/oficinas/equipamiento, multi) — **falta** |
| Formas de gestión (autogestionada/institucional privada/estatal/comunitaria/mixta) | Forma de tenencia (propietario único/comunidad/cooperativa/SOCIMI/fondo) — **falta granularidad** |
| Enfoques movilizadores (producción/memoria/comunitario/identitario/formativo/reivindicativo) | **No existe equivalente** — ¿agenda del bloque? ¿uso para qué función cívica? Hueco a definir |

Los dos primeros ejes son trasladables casi 1:1. Los dos últimos requieren reflexión sobre qué los hace diferentes en una cartografía cívica vs cultural.

### 3.4 Cartografía inventario vs humanística (Duxbury)

NODOS se ubica explícitamente en el **tipo humanístico** — no es un Google Maps de pines, es un mapa de memorias y relaciones. Cita:

> "El mockup no debe parecerse a un Google Maps con pines. Tiene que comunicar que este es un mapa de memorias y relaciones, no un directorio."

Demos iOS está exactamente en la misma tensión y NODOS la articula mejor. La ficha de un barrio en Polis debería poder llevar **testimonios cortos** de vecinos, no solo composición porcentual. La modal `BarrioModal` actual es demasiado de directorio. Esa cita debería pegarse en algún lado del repo de OCRE.

## 4. Lo que Demos iOS puede ofrecer a NODOS

Si la conversación va de "qué les damos", aquí hay piezas listas:

### 4.1 Identidad y perfil con cursus honorum

El TDR de NODOS pide "perfiles especializados de usuario" sin definir cuáles. En Demos iOS ya tenemos:

- 7 grados (Polites → Oikonómos → Ergátes → Didáskalos → Bouleutés → Strategós → Árchon)
- Función cívica concreta por grado
- Correspondencia profesional explícita
- Sistema de capital tridimensional (KOI/PAI/POL) que progresa con contribuciones

Esto **resuelve el problema de gamificación que NODOS está pagando USD 1 700 por consultar a Tomy Tomas**, con la ventaja de estar fundamentado en literatura cívica clásica (cursus honorum romano + epistemología griega) en vez de en Octalysis. Las críticas que Pancho hace a la propuesta de Tomy en `01_analisis_propuestas.md` se resuelven mostrándole que la literatura ya está aquí.

### 4.2 Sistema PEC como sustituto de likes/contadores

NODOS está pensando "sistema de puntos y reconocimientos" sin marco. Ya tenemos PEC (respaldo encarnado, visible) + reacciones (like/datos/opinión/ruido) que distingue calidad. Trasladable.

### 4.3 Stack técnico más sólido que el contratado

Casanova propone WordPress/Avada/PHP 8.4 sobre Dreamhost shared. Demos iOS corre sobre **Next.js 16 + Supabase + PostGIS + Vercel**. Diferencias que importan a NODOS:

| Dimensión | Casanova (WP+Avada) | Demos iOS (Next+Supabase) |
|---|---|---|
| **Geoespacial** | MySQL plano, sin PostGIS | PostGIS 3.3.7 con índices GIST nativos |
| **Escalado** | Dreamhost shared, lock-in | Vercel free → Pro autoscaling, Supabase libre 500 MB → Pro 8 GB |
| **Datos colaborativos** | Plugins WP (frágiles) | RLS de Supabase + auth integrada |
| **Cuotas Google Maps** | Dependencia Google for Nonprofits | Tiles libres OSM/Esri/MapTiler |
| **Multi-cartografía** | Una instancia WP por proyecto | Una sola plataforma con `proyecto_cartografico` como columna |
| **Coste runtime mensual** | $5-10 hosting + cuotas API | $0 free tier, $25 Pro a partir de ~50k MAU |
| **Bus de mantenimiento** | 3 desarrolladores en cadena | Un único stack moderno y documentado |

### 4.4 Tres puertas (Ágora · Bibliotheka · Polis) como columna vertebral

NODOS hoy tiene un único "modo": el mapa. La triada de Demos iOS encaja con sus tres ontologías:

- **Polis** ← espacios culturales (mapa con composición + ficha rica)
- **Bibliotheka** ← agentes (cursus honorum aplicado a colectivos: gestor → mediador → didáskalos cultural)
- **Ágora** ← prácticas (hilos sobre eventos, debates, convocatorias, talleres recurrentes)

## 5. Dónde chocan o requieren traducción

| Tensión | Cómo se resuelve |
|---|---|
| **Marca** — NODOS es marca propia con 5 años de trayectoria, no la van a disolver bajo Demos iOS. | Modo "tenant" o "white-label": Demos iOS como infra, branding propio por proyecto cartográfico |
| **Geografía** — NODOS = Lima/Perú, Demos iOS = Canarias. | La taxonomía territorial (`isla → municipio → barrio`) generalízase a (`region → ciudad → distrito`); las 8 secciones PHAROS pueden ser opcionales por tenant |
| **Vocabulario regional** — yunzas, polladas, peñas, pasacalles. | Diccionario regional por tenant, ya está propuesto en su §11 v0.2 |
| **Hispanohablante peruano vs canario** — diferencias léxicas importantes. | i18n de copies, no de schema |
| **Multi-cartografía concurrente** — Lima Centro + Comas + Norte + Sur. | Tabla `proyectos_cartograficos` con sus cohortes; cada feature lleva su FK |
| **Modelo de financiación** — NODOS recibe fondos públicos, Demos iOS busca consenso ciudadano voluntario. | No choca: ambos son no-comerciales |

## 6. Tres escenarios de colaboración

### Escenario A — Importas la metodología, NODOS sigue su camino

Pancho extrae la doctrina (3 ontologías + provenance + 4 ejes + Duxbury) y la aplica a Demos iOS. NODOS contrata Casanova como tenía previsto. Costo cero, beneficio para Demos iOS = enorme.

**Trabajo concreto en Demos iOS**: añadir tablas `agentes` y `practicas`, columnas `metodo_captura` y `proyecto_cartografico` en `contribuciones`, tabla `proyectos_cartograficos`, citar la metodología en `docs/`. 3-4 horas de migración SQL + algo de código.

### Escenario B — Ofreces Demos iOS como alternativa al MVP de Casanova

Demos iOS se vuelve la plataforma de NODOS. La organización deja Google My Maps + plan WordPress y migra a `nodos.demosios.eu` o subdominio propio. Pancho diseña la migración y absorbe el trabajo de Casanova.

**Pros**: NODOS gana stack sólido, ahorra USD 1 580. Pancho monetiza Demos iOS o suma una organización al ecosistema. La metodología NODOS fortalece Demos iOS desde dentro.

**Contras**: Pancho asume entrega contra plazo de junio 2026 (2 meses). Habría que negociar con NODOS para reasignar el presupuesto destinado a Casanova al desarrollo del adaptador NODOS dentro de Demos iOS.

### Escenario C — Fork especializado de Demos iOS para mapeo cultural

Demos iOS evoluciona a un OS cívico genérico que admite **dos perfiles de uso**:
1. **Cívico territorial** (caso Canarias original): mapeo de capital + recuperación de espacios.
2. **Cultural participativo** (caso NODOS y futuros): mapeo de espacios + agentes + prácticas culturales.

La arquitectura es la misma; cambia la taxonomía PHAROS por una taxonomía cultural (los 4 ejes de NODOS), el sistema de capital por un sistema de visibilidad cultural, y los TIPOS de bloque por TIPOS de espacio cultural. Cada cohorte ("tenant") elige perfil al alta.

**Trabajo**: 2-3 semanas adicionales sobre Demos iOS para crear la capa de tenants y los dos perfiles. Beneficio = Demos iOS pasa de ser "OS cívico canario" a "OS cívico replicable", que era ya parte de tu visión por la propuesta C en INTEGRACION_KOINOS.md.

## 7. Recomendación

**Empezar por A, planear B**. Concretamente:

1. **Esta semana**: extraer las tres ontologías (espacios/agentes/prácticas) y los campos de provenance del v0.1/v0.2 de NODOS y traerlos como issues / migración SQL en Demos iOS. Es trabajo de horas y deja el modelo de datos mucho más rico.

2. **Próximas dos semanas**: hablar con NODOS antes de que firmen Casanova. Mostrarles el v0.2 + Demos iOS lado a lado. Plantear que **el MVP que están a punto de pagar ya está construido** (Pancho lo tiene en `Nodos v0.2/app/`), y que el camino sólido es montarlo sobre Demos iOS infra (Supabase + Vercel) en vez de WordPress.

3. **Si NODOS acepta**: redirigir parte del presupuesto Casanova hacia Pancho como integrador, contratar a Tomy Tomas reducido al Entregable 01 con criterios de aceptación duros (las críticas en el §3.3 de `01_analisis_propuestas.md` ya están fundadas).

4. **Si NODOS no acepta**: que sigan con Casanova. Aprender de su recorrido los próximos meses, porque NODOS va a tropezar con cosas concretas (ETL de 600 espacios, moderación, cuotas Google) que nos servirán para no tropezar igual cuando Demos iOS llegue a Canarias entera.

Lo que **no se debería hacer** es absorberlo silenciosamente sin contar con la organización Nodos Culturales: tienen 5 años, marca, financiación y derecho moral a sus datos y método. La conversación tiene que ser explícita con su gente, no solo con Pancho como asesor.

## 8. Preguntas que faltan resolver con Pancho

1. ¿Cuál es tu rol formal en NODOS? ¿Eres parte del consorcio Nodos Culturales o consultor externo en este proyecto concreto?
2. ¿Tienes derechos sobre el código del v0.1+v0.2 que ya construiste, o son entregables propiedad del consorcio?
3. ¿Quién es el interlocutor en NODOS con poder de decisión sobre el stack? Si es solo Casanova, no merece la pena la conversación; si es la dirección de Nodos Culturales, sí.
4. ¿Hay restricción contractual o de fondo que obligue a usar WordPress/Avada porque ya está pagado?
5. ¿Qué te interesa más a ti — absorber su metodología (escenario A) o ganarles como tenant de Demos iOS (escenarios B/C)?
