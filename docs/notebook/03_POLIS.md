# POLIS — Modo cívico y territorial

> "Tu ciudad como red social. Toca un pin para leer o suelta uno donde estés."
> — `src/app/feed/page.tsx`, `POLIS_MEDAL_COPY.mapear`.

> **Filiación arquitectónica (2026-05-02):** POLIS queda **fuera del eje pronominal YO/NOSOTROS/ELLO** porque su unidad significativa es el **lugar**, no el sujeto. Asume tres funciones: (1) mapa cívico canario que ya está en marcha, (2) **intercambio práctico anclado al territorio** — coche compartido, oficios cerca, busco/ofrezco geo-localizados — pieza que antes vivía en Koiná y se traslada aquí porque es geográfica por naturaleza, (3) **registro territorial colectivo** — un bloque cambia de manos, una plaza se peatonaliza, un comercio cierra. Ver decisión arquitectónica completa en [`docs/IDEAS.md → Arquitectura del proyecto`](../IDEAS.md#arquitectura-del-proyecto).

---

## 1. Qué es POLIS

POLIS es el modo de KOINOS que une **ciudad, trámite y acción colectiva**. Es la plaza del proyecto: un mapa de tu entorno donde los vecinos dejan avisos, peticiones, ofertas, y donde el municipio aparece como una ventanilla única accesible desde ese mismo mapa.

POLIS se diferencia de las otras dos capas en que **no es un feed de contenido puro**: los posts viven anclados a un lugar geográfico. Mover el foco del mapa cambia lo que se ve. La unidad mínima es el **pin**, no el post.

POLIS absorbe además todo el trabajo técnico del **digitalizador urbano pixel art**, documentado por separado en `POLIS_digitalizador_urbano.md`, que convierte fotos reales de la ciudad en tilesets y scripts Godot usando perfiles de material calibrables. Ese pipeline es la "interpretación pixel art" de POLIS; a nivel de UI/UX, lo que importa aquí es cómo el usuario llega al mapa y qué puede hacer en él.

### 1.1 Submodos activos en el código

Definidos en `POLIS_MEDALS` (líneas 375–380 de `src/app/feed/page.tsx`):

| Medalla     | Icono     | Qué hace (según `POLIS_MEDAL_COPY`)                                           |
|-------------|-----------|-------------------------------------------------------------------------------|
| Mapear      | MapIcon   | "Tu ciudad como red social. Toca un pin para leer o suelta uno donde estés." |
| Peticionar  | Flag      | "Toca un lugar del mapa y firma una petición ciudadana."                      |
| Ocupación   | Briefcase | "Empleo, voluntariado y oficios abiertos cerca de ti."                        |
| Ventanilla  | Building2 | "Trámites municipales, directos, sin intermediarios."                         |

Los pines actuales son datos de ejemplo en `POLI_PINS` (línea ~1572), todos en Las Palmas de Gran Canaria (Triana, Plaza del Pilar, El Confital, Las Canteras, Vegueta). El mapa está renderizado hoy como **SVG estilizado placeholder**; la intención declarada en comentario es cablear **Leaflet**.

### 1.2 Categorías PHAROS que clasifican los pines

De `src/lib/pharos/categorias.ts` (10 categorías):

Urbanismo · Movilidad · Medioambiente · Cultura · Comunidad · Educación · Economía Local · Participación · Bienestar · General.

Estas son las **categorías de pin** (distintas de las 8 secciones temáticas del FEED). Cada pin lleva una `catId` que colorea y filtra. Dos taxonomías distintas conviven porque responden a preguntas distintas: secciones = ejes del debate público; categorías = facetas del lugar físico.

---

## 2. Investigación: el estado del arte en participación digital urbana

### 2.1 Decidim (Barcelona, 2016 → 2026)

Decidim es el referente internacional inevitable. Creada por el Ayuntamiento de Barcelona en 2016, hoy tiene **más de 400 instancias activas en 20 países**, adoptada por gobiernos de Ciudad de México, Helsinki, Nueva York, Kakogawa (Japón), y por la Asamblea Nacional francesa. En 2019 la Comisión Europea la reconoció como uno de los proyectos open source más innovadores de Europa.

Los **componentes** que Decidim ofrece de fábrica son:

- **Proposals** — la unidad mínima de decisión (un wizard guía al ciudadano, permite adjuntar documentos y geolocalizar la propuesta).
- **Debates** — hilos de discusión estructurados, con comentarios marcados como "a favor", "en contra" o "neutro".
- **Participatory Budgets** — formulario especial para "gastar" un presupuesto repartiéndolo entre proyectos; los votos se limitan por el coste acumulado.
- **Accountability** — seguimiento del estado de implementación de cada proyecto aprobado. Esta es la joya técnica de Decidim: te dice qué pasó con lo que votaste.
- **Meetings** — convocatorias presenciales integradas en el flujo digital.
- **Surveys, Sortitions, Initiatives, Blogs, Pages** como componentes secundarios.

**Lectura para KOINOS:** Decidim es robusta, pero es **institucional**: el usuario llega desde el ayuntamiento, no desde un feed. KOINOS parte del lugar contrario — del feed social. El valor de POLIS respecto a Decidim es la **entrada ambiental**: el usuario está en FEED, toca POLIS, y aterriza en el mapa de su ciudad. Esa fricción bajada es el gran vacío que Decidim nunca rellenó.

Lo sensato es **no competir con Decidim en lo que hace bien** (proposals, budgets, accountability) y, en cambio, **interoperar**: si existe una Decidim local (como Decide Madrid o la propia de Barcelona), POLIS puede consumir sus datos por API e incrustarlos como capa de información en el mapa, sin construirlos desde cero. Decidim es open source y expone estructura de datos estable.

### 2.2 FixMyStreet y SeeClickFix

FixMyStreet (mySociety, Reino Unido) es el patrón clásico de **reportar problemas urbanos al municipio**: bache, farola fundida, basura acumulada, grafiti. El ciudadano marca el punto en el mapa, fotografía, categoriza, envía. La plataforma enruta al organismo competente y hace visible el estado. SeeClickFix hace algo similar en EE.UU.

Para 2025–2026, el patrón ya no es novedoso: es infraestructura. Pero **la mayoría de ciudades españolas sigue sin tener nada comparable**, con la excepción parcial de Madrid (Línea Madrid) y Barcelona. El gap de mercado sigue abierto.

**Lectura para KOINOS:** el submodo **Peticionar** de POLIS está a un paso de ser un FixMyStreet local con la ventaja del semáforo y del PEC. La diferencia es que en FixMyStreet reportas al ayuntamiento; en POLIS reportas a la **comunidad** y el municipio entra como receptor secundario. Ese giro hace que el problema exista aunque el ayuntamiento no lo quiera ver.

### 2.3 pol.is / vTaiwan como laboratorio cívico

Ya discutido en `02_FEED.md`, pero tiene una lectura específica para POLIS: cuando un tema local escala y necesita deliberación (por ejemplo: peatonalización de Vegueta), POLIS puede lanzar un "módulo pol.is" asociado al pin del lugar. La deliberación queda **anclada a su sitio**.

### 2.4 Citizen science y mapeo participativo

OpenStreetMap, Mapillary, CitizenLab, Maptionnaire, Neighborland: todos los proyectos que trabajan sobre mapas ciudadanos coinciden en que el valor emerge cuando el ciudadano puede **fotografiar + geolocalizar + categorizar** en un solo gesto móvil.

Mapillary en particular (gratis, open source, con imágenes geolocalizadas de voluntarios) ya se menciona en `POLIS_digitalizador_urbano.md` como fuente para el pipeline pixel art. Es la fuente de imágenes más interoperable hoy.

### 2.5 Ventanilla única digital: lo que las administraciones ofrecen hoy

Carpeta Ciudadana (administración central), Cl@ve, Mi Carpeta del ayuntamiento X, apps municipales propias. El problema estructural es que todas son **silos** con UX inconsistente y lenguaje administrativo. La "ventanilla única" real en España sigue sin existir como experiencia de usuario: está fragmentada entre 8000 municipios.

**Lectura para KOINOS:** la "Ventanilla" de POLIS no puede ser el backend de trámites (eso lo hace la administración). Puede ser el **frontal amable** — el usuario llega a POLIS, ve los 5 trámites más comunes de su municipio (empadronamiento, cita previa, tributos), y POLIS lo lleva al sitio correcto con lenguaje plano. La innovación no es técnica, es lingüística y de fricción.

---

## 3. Gaps y necesidades no cubiertas

| Área                                 | Estado en KOINOS | Gap                                                                           |
|--------------------------------------|------------------|-------------------------------------------------------------------------------|
| Mapa real                            | SVG placeholder  | Cablear Leaflet con tiles (puede ser OpenStreetMap estándar o tiles pixel art generados por el digitalizador). |
| Geolocalización del usuario          | No existe        | Permiso del navegador + "soltar pin donde estás". Básico pero aún no hecho.   |
| Creación de pines desde la UI        | No existe        | Los pines son datos estáticos. Falta `createPin({lat, lng, title, body, catId})`. |
| Firma de petición                    | Copy             | Falta modelo de datos (`signatures: user[]`, contador, umbral visible).       |
| Integración con Decidim u otra fuente institucional | No existe | Idea abierta: ver 4.1.                                                        |
| Cobertura de municipio               | No definida      | ¿Arrancar en Las Palmas como piloto (pins ya son de LPGC)? ¿Multi-municipio desde el día 1? |
| Búsqueda por dirección               | No existe        | Geocoder básico (Nominatim OSM).                                              |
| Deliberación asociada al pin         | No existe        | Hilo en miniatura + posibilidad de abrir un pol.is sobre el pin.              |
| Lenguaje administrativo              | No tratado       | Reescribir los trámites en lenguaje plano es una tarea editorial continua, no un sprint. |
| Moderación                           | No definida      | Quién decide si un pin es spam, y cómo se retira sin censurar.                |

---

## 4. Backlog de ideas para POLIS

### 4.1 Interoperabilidad con Decidim como capa de información
Cuando exista Decidim en el municipio del usuario, POLIS lee su API y muestra las propuestas activas como **pines especiales** en el mapa con un icono distinto (icono "Decidim"). Al tocar, el usuario ve el estado real de la propuesta (en debate / aprobada / rechazada / en ejecución) y puede saltar a la plataforma oficial para votar. POLIS se convierte en un **gateway amigable** a la participación institucional, no en un competidor. Para ciudades sin Decidim, POLIS actúa standalone.

### 4.2 Ventanilla contextual por ubicación
La Ventanilla única muestra **trámites relevantes para donde estás**. Si estás en un barrio con obra pública activa, aparece "ver plan de actuación". Si estás en una zona con zona verde, aparece "reservar huerto urbano". Esto es lo que el gobierno nunca hace bien porque no razona por contexto. POLIS puede hacerlo porque ya tiene el mapa.

### 4.3 Pins con ciclo de vida y caducidad
Un pin de "aviso" (bordillo roto) debe poder cerrarse cuando se arregla. Un pin de "evento" (mercadillo del sábado) debe desaparecer al día siguiente. Un pin de "asamblea" debe convertirse en acta cuando se celebra. Añadir un campo `life_cycle: 'aviso' | 'evento' | 'asamblea' | 'peticion' | 'oferta'` que define reglas de caducidad y de estado.

### 4.4 Pins de oferta (el submodo Ocupación)
Ocupación puede ser el sitio donde los **pequeños oficios locales** publican ofertas: fontanero disponible el martes, clase particular a 10€/h, alguien busca compañía para pasear al perro. Es NextDoor + Wallapop + Milanuncios, pero al lado del mapa real y con el nombre del vecino. La clave es que **no hay pago dentro de la app** — POLIS solo facilita el encuentro.

### 4.5 Gamificación ligera por contribución
Cada pin que otro usuario marca como útil (PEC en versión POLIS) suma al autor una "insignia de calle" que aparece junto a su nombre (estilo merecer el cargo de vecino útil). Esto conecta con lo que haya en `Notebook/GAMIFICACIÓN` — aún pendiente de integración. Lo que hay que evitar es gamificar la cantidad (más pines, más puntos); hay que premiar la calidad (pines que resuelven cosas).

### 4.6 Línea temporal del barrio
Además del mapa espacial, una vista cronológica del barrio: "esta semana en Vegueta". Lista los pines de los últimos 7 días, con sus estados. Útil para vecinos que llegan tarde a una conversación colectiva.

### 4.7 Capa pixel art real (integración con el digitalizador)
Cuando el digitalizador urbano del `POLIS_digitalizador_urbano.md` tenga perfiles de material definidos para un barrio, POLIS puede ofrecer el mapa en **dos modos de visualización**: mapa estándar (OSM) y mapa pixel art (tiles generados por el pipeline). Al entrar al mapa, animación corta de transición de un estilo al otro. Eso convierte a POLIS en su propio demo del digitalizador.

### 4.8 Asamblea digital con pol.is anclada al pin
Cuando un pin escala (muchas firmas, muchos comentarios), POLIS propone **abrir una asamblea pol.is** sobre el tema. El pin queda enlazado al mapa de consenso. Pasamos de "queja local" a "deliberación estructurada" con un botón, sin fricción.

### 4.9 Patrimonio visual acumulado
Cada foto que un usuario saca y sube a POLIS para reportar algo (bordillo roto, fachada pintada) entra en un archivo visual del barrio. Con el tiempo, es un registro de cómo cambia el entorno. Convertirlo en una **línea temporal visual del barrio** aporta valor histórico. Es un Google Street View comunitario, pero curado por vecinos y con contexto.

### 4.10 Notificación de cambio de estado por radio
Si el usuario marca un pin como "me interesa", POLIS le avisa cuando algo cambia: el ayuntamiento responde, se arregla el problema, aparece un pin nuevo al lado. La notificación es del sitio, no de la persona. Esto genera pertenencia al barrio.

---

## 5. Preguntas abiertas

1. **¿Arrancamos en Las Palmas de Gran Canaria como piloto único o multi-ciudad desde el principio?** Los `POLI_PINS` ya son de LPGC (Triana, Plaza del Pilar, El Confital, Las Canteras, Vegueta). Tiene sentido usar eso como primera ciudad piloto y aprender antes de escalar.
2. **¿Qué hacemos con la moderación?** Si un pin es acusatorio o falso (vecino acusando a otro), la respuesta debe estar pensada antes del lanzamiento. Recomendación: semáforo y PEC como primera línea de moderación comunitaria (igual que en FEED), con posibilidad de reporte a un tercero editorial solo en casos claros.
3. **¿La Ventanilla única es por municipio o unificada?** La tentación es unificarla en todo el Estado. La realidad técnica es que cada municipio tiene su propio backend. Recomendación: unificada en UX, enrutada en backend — el usuario ve una sola interfaz; POLIS sabe que el usuario está en LPGC y enruta al portal del Ayuntamiento de Las Palmas.
4. **¿Leaflet o Mapbox o algo propio con tiles pixel art?** Leaflet es open source, ligero, perfectamente compatible con tiles custom. Mapbox es más potente pero de pago. Recomendación: Leaflet con OSM por defecto y un toggle futuro a tiles pixel art del digitalizador.
5. **¿Cómo conecta POLIS con el modo `mapear` que ya existe como página suelta en `src/app/mapear/page.tsx`?** Hoy son dos rutas separadas. Decidir si `mapear` se absorbe dentro del modo POLIS del feed o sigue siendo una ruta independiente que comparte componentes.

---

## 6. Entradas mínimas al código para la siguiente iteración

- Cablear Leaflet en `PolisMode` (línea ~1639). Empezar con tiles OSM estándar y pines sobre `POLI_PINS`.
- Añadir modelo Supabase `polis_pins` (`id`, `lat`, `lng`, `title`, `body`, `author_id`, `cat_id`, `life_cycle`, `created_at`, `expires_at`, `sign_count`).
- Permiso de geolocalización y botón "soltar pin aquí".
- Evaluar si `src/app/mapear/page.tsx` debe fusionarse con `PolisMode` o mantenerse como ruta independiente.
- Contrato con `POLIS_digitalizador_urbano.md`: decidir si los tiles pixel art se sirven desde la misma app o desde una URL CDN.

---

## Fuentes consultadas para este documento

- [Decidim Features — Official](https://decidim.org/features/)
- [Decidim Components Documentation](https://docs.decidim.org/en/develop/features/components.html)
- [Decidim Barcelona — technology to encourage participation, Ajuntament de Barcelona](https://ajuntament.barcelona.cat/usosdeltemps/en/actuacio/decidim-barcelona-technology-encourage-participation)
- [Decidim Barcelona: Participatory Budgeting — Participedia](https://participedia.net/case/decidim-participatory-budgeting-in-barcelona)
- [Decidim — Wikipedia](https://en.wikipedia.org/wiki/Decidim)
- [Lessons From Consensus Building in Taiwan](https://democracy-technologies.org/participation/consensus-building-in-taiwan/)
- [vTaiwan — Participedia](https://participedia.net/method/vtaiwan)
- [FixMyStreet — Information for citizens](https://www.fixmystreet.com/faq)
- [Citizen Science and OpenStreetMap — ResearchGate](https://www.researchgate.net/publication/327779351_Citizen_Science_and_Open_Street_Map_-_Potential_and_challenges)
- [7 Techniques for Adaptive Cartography That Transform Urban Planning — Map Library](https://www.maplibrary.org/10803/7-techniques-for-adaptive-cartography-in-urban-planning/)
- [Community Mapping — GFDRR](http://gfdrr.github.io/community-mapping/)
- [Mapping citizens' emotions: participatory planning support system in Olomouc — Tandfonline](https://www.tandfonline.com/doi/full/10.1080/17445647.2018.1546624)
- [Participatory Mapping and Visualization of Local Knowledge — Springer Nature](https://link.springer.com/article/10.1007/s13753-020-00312-8)

*Código de referencia en `src/app/feed/page.tsx` líneas 375–380, 1556–2012, y `POLIS_digitalizador_urbano.md` en raíz del proyecto.*
