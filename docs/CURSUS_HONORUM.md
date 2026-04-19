# Cursus honorum de OCRE

Siete grados cívicos con nombre griego clásico, función contemporánea concreta y correspondencia profesional explícita. El objetivo último no es adornar: **permitir que la escalera cívica articule mañana una red profesional real** (autónomos, cooperativas, asociaciones, cargos electos) dentro de OCRE.

Implementación: [`src/lib/cursus/grados.ts`](../src/lib/cursus/grados.ts).

## Resumen de grados

| Nv | Nombre | Latino | Traducción | Atributo | Color |
|----|--------|--------|------------|:-:|---|
| 0 | Polítes | POLITES | ciudadano/a | ○ | ocre profundo |
| 1 | Oikonómos | OIKONOMOS | gestor/a del hogar | ⬡ | siena |
| 2 | Ergátes | ERGATES | trabajador/a cualificado/a | ◆ | ocre |
| 3 | Didáskalos | DIDASKALOS | maestro/a | ✦ | ámbar |
| 4 | Bouleutés | BOULEUTES | consejero/a del barrio | ❖ | oliva |
| 5 | Strategós | STRATEGOS | estratega | ✶ | sangre |
| 6 | Árchon | ARCHON | arconte | ♁ | carbón |

## Los grados en detalle

### 0 · Polítes (πολίτης) — ciudadano/a
- **Lema**: «Te inscribes, participas, aprendes.»
- **Función cívica**: acceso básico al Ágora y a la Bibliotheka, PEC a otras aportaciones, pines en Polis.
- **Correspondencia profesional**: cualquier persona empadronada.
- **Requisito**: registrarse.

### 1 · Oikonómos (οἰκονόμος) — gestor/a del hogar
- **Lema**: «Pone oficio y cuidado al servicio del común.»
- **Función cívica**: publica recursos en Koiná, ofrece servicios verificados de barrio.
- **Correspondencia profesional**: autónomos/as, artesanos/as, oficios del cuidado, pequeño comercio.
- **Requisito**: 20+ koinonía · 40+ total · 3 recursos publicados · 5 PECs.

### 2 · Ergátes (ἐργάτης) — trabajador/a cualificado/a
- **Lema**: «Convierte su oficio en formación pública.»
- **Función cívica**: abre serie propia en el Cursus, modera su sección en el Ágora.
- **Correspondencia profesional**: técnicos/as, profesionales cualificados/as, PYMEs de servicios, cooperativas pequeñas.
- **Requisito**: 60+ paideía · 120+ total · 5 vídeos · 15 PECs.

### 3 · Didáskalos (διδάσκαλος) — maestro/a
- **Lema**: «Enseña y sostiene el hilo de una disciplina.»
- **Función cívica**: fija hilo de referencia en Ágora, propone currículos en Bibliotheka, valida series de otros ergátai.
- **Correspondencia profesional**: formadores/as, educadores/as, divulgadores/as, cooperativas de conocimiento.
- **Requisito**: 160+ paideía · 300+ total · 10 vídeos · 50 PECs · 1 hilo fijado.

### 4 · Bouleutés (βουλευτής) — consejero/a del barrio
- **Lema**: «Representa la voz del barrio en el común.»
- **Función cívica**: propone acciones en Polis, convoca votaciones de barrio, acredita candidatos a recuperación.
- **Correspondencia profesional**: tejido asociativo, AMPAs, cooperativas de consumo, delegados/as de PYMEs locales.
- **Requisito**: 120+ politeía · 400+ total · presencia activa en 3 barrios · 50 PECs totales.

### 5 · Strategós (στρατηγός) — estratega
- **Lema**: «Lidera campañas de recuperación de espacio.»
- **Función cívica**: abre procesos formales de recuperación de bloques en Polis, coordina cooperativas de intervención con varios oikonómoi y ergátai.
- **Correspondencia profesional**: gestores/as culturales, promotores/as de economía social, directores/as de cooperativa, coordinadores/as de barrio.
- **Requisito**: 300+ politeía · 800+ total · 1 espacio recuperado · 100 PECs.

### 6 · Árchon (ἄρχων) — arconte
- **Lema**: «Custodia el común durante un mandato.»
- **Función cívica**: convoca asambleas abiertas, veta aprobaciones, custodia el inventario de Koiná. **Rotatorio y revocable.**
- **Correspondencia profesional**: referentes comunitarios electos, consejos rectores, cargos cívicos rotatorios.
- **Requisito**: 1600+ total · elección democrática anual.

## Decisiones de diseño

1. **Nombres en griego, transliteración latina visible.** El griego ocupa el espacio de título (romanticismo clásico); la transliteración en caja alta aparece debajo como `eyebrow` para que nadie tenga que descifrar el alfabeto.
2. **Atributo simbólico mínimo, no figurativo.** Un símbolo tipográfico clásico (○, ⬡, ◆, ✦, ❖, ✶, ♁). Deja espacio al avatar real del ciudadano y no cansa al escalar.
3. **Función cívica explícita**, no solo "más puntos". Cada grado abre capacidades concretas de la plataforma (publicar, moderar, fijar hilo, proponer recuperación).
4. **Correspondencia profesional contemporánea**, no metáfora. Un oikonómos real es un autónomo/a o artesano/a; un bouleutés real es un miembro del tejido asociativo. La idea es que OCRE, al madurar, pueda ofrecer **enlace profesional**: cuando un barrio necesita un electricista con ética del común, el sistema sugiere oikonómoi cercanos con PECs relevantes.
5. **Árchon es electo y rotatorio.** No se alcanza sumando puntos: se alcanza por elección anual. Evita que el cursus se convierta en una escalera de poder acumulado.

## Variantes futuras (abierto)

- Un track paralelo más artístico (`poietés` → poeta, dramaturgo, artista) si el corpus cultural lo reclama.
- Insignias **no lineales** ("custodio/a del agua", "guardián/ana de la biblioteca del barrio") que crucen el cursus y aporten reconocimiento lateral.
- Mapa de **redes profesionales**: dado un grado y una sección PHAROS, encontrar peers en barrios vecinos.
