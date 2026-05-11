# KOINOS · POLIS — Fuentes de eventos LPGC v1

> Listado priorizado de fuentes para la primera iteración del rastreador.
> Versión 1 · 9 mayo 2026 · zona piloto Las Canteras + LPGC

## Capas

- **Estructurada** — calendario público, RSS, iCal, API. Scraper Python directo, cero LLM. Frecuencia alta.
- **Semi-estructurada** — HTML estable con estructura repetitiva, requiere selectores. Haiku interviene para extraer datos de prose cuando hace falta. Frecuencia media.
- **Caótica** — redes sociales, posts libres. Haiku obligatorio para extraer fecha, lugar, tipo. Frecuencia baja, alta intervención humana.

## Capa estructurada (10 fuentes prioritarias)

### Ayuntamiento y agencias municipales

1. **Ayuntamiento de LPGC — Agenda municipal**
   `laspalmasgc.es/agenda` — agenda oficial. Cubre cultura, deporte, comunidad, institucional. RSS no documentado pero el HTML es repetitivo. Frecuencia diaria.

2. **LPA Cultura**
   `lpacultura.com` — programación de teatro, museos, espacios culturales municipales (Pérez Galdós, San Martín, Castillo de Mata). Frecuencia diaria.

3. **Ayuntamiento — Sede electrónica · plazos abiertos**
   `sede.laspalmasgc.es` — convocatorias, subvenciones, oposiciones. Categoría institucional/convocatoria. Frecuencia semanal.

4. **Cabildo de Gran Canaria — Agenda**
   `grancanaria.com/agenda` — eventos del Cabildo (Patronato de Turismo, Casa Colón, Jardín Canario). Cubre toda la isla. Frecuencia diaria.

### Espacios culturales con calendario propio

5. **Auditorio Alfredo Kraus**
   `auditorio-alfredokraus.org` — programación de la OFGC y conciertos. Frecuencia semanal.

6. **CICCA — Centro de Iniciativas de Caja Canarias**
   `cicca.fundacioncajacanarias.com` — conferencias, ciclos de cine, exposiciones. Frecuencia semanal.

7. **Gabinete Literario**
   `gabineteliterario.com` — literatura, debate, presentaciones. Frecuencia semanal.

8. **Teatro Pérez Galdós**
   `teatroperezgaldos.es` — temporada de teatro y ópera. Frecuencia mensual con grandes batches.

### Educación y conocimiento

9. **ULPGC — Eventos**
   `ulpgc.es/eventos` — actividades universitarias abiertas al público. Frecuencia diaria en periodo lectivo.

10. **CICEI / Foro de Empresas**
    Conferencias técnicas y empresariales. Frecuencia semanal.

## Capa semi-estructurada (10 fuentes)

Requieren selectores específicos y a veces Haiku para parsear horarios/lugares en prose.

### Salas privadas

11. **Sala Pereyra**
    Programación de conciertos en formato post. Frecuencia 2-3 anuncios/semana.

12. **Paper Club**
    Música electrónica, eventos nocturnos. Frecuencia semanal.

13. **El Sótano**
    Concertos pequeño formato, jam sessions. Frecuencia semanal.

14. **Sala Insular de Teatro**
    Compañías locales y residencias. Frecuencia mensual.

### Plataformas de eventos

15. **Eventbrite — filtro Las Palmas de Gran Canaria**
    `eventbrite.es/d/spain--las-palmas-de-gran-canaria/all-events` — talleres, encuentros, charlas. Mucho ruido, requiere filtrado por relevancia. Frecuencia diaria.

16. **Meetup — grupos de LPGC**
    Encuentros de comunidades temáticas (running, lenguas, tech, board games). Frecuencia semanal por grupo.

17. **Atrápalo / Notikumi**
    Eventos con entrada. Frecuencia diaria.

### Medios y agendas locales

18. **Canarias7 — agenda**
    `canarias7.es/cultura/agenda` — mezcla cultural y de ocio. Frecuencia diaria.

19. **La Provincia — agenda**
    `laprovincia.es/cultura/agenda` — similar al anterior, redacción algo distinta. Frecuencia diaria.

20. **Holaislascanarias.com**
    Patronato de Turismo, eventos turísticos. Frecuencia diaria, sesgado a visitantes.

## Capa caótica (5-10 fuentes piloto)

Redes sociales públicas. Cobertura ancha pero requiere parsing por LLM y validación humana.

### Cuentas a seguir (lista inicial)

21. **Instagram público**
    `@lpaculturaweb`, `@auditoriokrausoficial`, `@perezgaldoslpa`, `@gabineteliterario_oficial`, `@papercluboficial`. Posts con flyer + caption suelen contener fecha y hora. Haiku extrae JSON. Frecuencia diaria.

22. **Twitter/X**
    `@LPACultura`, `@CabildoGC`, `@LPA_Ayuntamiento`, `@ulpgc`, `@CanariasCultura`. Anuncios y recordatorios. Frecuencia diaria.

23. **Facebook events**
    Eventos públicos creados por organizaciones locales. API de Meta es restrictiva, scraping web frágil. Considerar integración manual de organizadores institucionales mediante el dashboard.

24. **Asociaciones vecinales — webs y RRSS dispares**
    Federación de Asociaciones de Vecinos de LPGC + asociaciones individuales (Las Canteras, Vegueta, San Cristóbal, Triana, etc.). Cada una tiene su canal: blog, FB, Insta, ninguno. Aquí lo eficiente es invitarles directamente al dashboard institucional cuando esté listo.

25. **Cuentas de artistas y promotores locales**
    Selección curada por el equipo (5-15 cuentas Insta) con buena tasa de eventos vivos. Lista creciente con feedback de uso.

## Frecuencias y costes

| Capa | Fuentes | Frecuencia rastreo | LLM | Coste mensual estimado |
|---|---|---|---|---|
| Estructurada | 10 | cada 1h | no | 0€ |
| Semi-estructurada | 10 | cada 3h | parcial Haiku | ~1€ |
| Caótica | 10-15 | cada 6h | Haiku siempre | ~3-5€ |

Total esperado: **menos de 10€/mes** para rastreo continuo, sin contar el dashboard institucional (que requiere desarrollo pero no rastreo).

## Estrategia de rollout

1. **Sprint 1** — implementar solo fuentes 1, 2, 4, 5, 9 (ayuntamiento, LPA Cultura, Cabildo, Auditorio Kraus, ULPGC). Cinco fuentes, todas estructuradas, sin LLM. Cubre el 60% de la actividad cultural-institucional con cero coste recurrente. Tiempo: 1 semana de programación.

2. **Sprint 2** — añadir capa semi-estructurada de salas privadas (11-14) y plataformas (15, 16). Empieza el coste Haiku, que es marginal. Cubre el 80% acumulado. Tiempo: 1 semana.

3. **Sprint 3** — capa caótica con Instagram público de las cinco cuentas más activas. Empieza la curación humana. Tiempo: 1-2 semanas según calidad de los parsers.

4. **Sprint 4** — dashboard institucional para que ayuntamiento y asociaciones publiquen directamente. A partir de aquí el rastreo se descongestiona porque las fuentes oficiales se vuelven "estructuradas por diseño". Tiempo: 2-3 semanas.

## Notas honestas

- Los nombres de cuentas Instagram pueden cambiar; la lista de arriba es indicativa y debe verificarse antes de programar el scraper.
- Algunos sitios cambian su HTML cada pocos meses; presupuestar mantenimiento de selectores es realista (~2h cada dos semanas).
- El permiso para scrapear redes sociales públicas está en zona gris — el patrón seguro es ceñirse al contenido público accesible sin login y respetar `robots.txt` y rate limits razonables.
- Las cinco fuentes del Sprint 1 deberían cubrir desde el primer día las **1-2 manzanas con más actividad de LPGC** (Vegueta, Triana, Las Canteras), que es el caso de uso del 80% de pruebas iniciales.
