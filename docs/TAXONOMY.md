# KOINOS · POLIS — Taxonomía de actividades y eventos

> Capa dinámica que se monta sobre el data pack estático.
> Versión 1 · borrador para discusión · 9 mayo 2026

## Filosofía

La realidad de un evento tiene tres ejes ortogonales, no uno solo. Forzarla a un árbol único pierde matiz. La taxonomía aquí descrita cruza una **categoría temática** (8 L1, ~30 L2) con dos **dimensiones independientes**: temporalidad y acceso. Un mismo evento puede ser «Cultura → Música → Concierto» con temporalidad «puntual» y acceso «libre», o «Institucional → Pleno municipal» con temporalidad «recurrente mensual» y acceso «libre asistencia presencial».

## Categorías de primer nivel (L1)

Ocho categorías que cubren el ~95% de lo que sucede en una ciudad de tamaño medio sin solapamiento excesivo. Cada una tiene un color asignado del meta.json de los data packs para mantener consistencia visual.

### 1. Cultura `#9F4FE6` (alojamiento → cultura)

Producción cultural en sentido amplio. Lo que necesita un escenario, una pared o un atril.

- **Música** — concierto, recital, jam session, DJ set, performance sonora
- **Artes escénicas** — teatro, danza, performance, circo, monólogo
- **Artes visuales** — exposición, vernissage, taller artístico, intervención urbana
- **Literatura** — presentación de libro, lectura, club de lectura, recital poético
- **Cine y audiovisual** — proyección, cinefórum, festival, estreno

### 2. Comunidad `#E68A4F` (restauración → comunidad)

Lo cívico horizontal. La parte donde la ciudad se gobierna a sí misma desde abajo.

- **Asamblea vecinal** — reunión de barrio, federación vecinal, consejo de distrito
- **Voluntariado** — limpieza, plantación, ayuda a personas mayores, banco de alimentos
- **Mercadillo e intercambio** — trueque, mercadillo de segunda mano, free shop
- **Acción colectiva** — manifestación, concentración, protesta, campaña
- **Encuentro abierto** — café filosófico, picnic vecinal, paseo organizado

### 3. Educación `#4F8AE6` (comercio → educación)

Transmisión de conocimiento. Distinto de cultura porque el objetivo es aprender, no contemplar.

- **Conferencia y ponencia** — magistral, ciclo, charla TED-style
- **Taller y curso** — práctico, formación reglada, intensivo
- **Foro y debate** — mesa redonda, diálogo, conversatorio
- **Presentación científica** — defensa de tesis, simposio, congreso

### 4. Deporte y bienestar `#4FE69F` (salud → deporte)

Actividad física en cualquier forma, individual o colectiva.

- **Deporte de equipo** — partido oficial, partidillo abierto, torneo
- **Deporte individual** — carrera, ruta de senderismo, ciclismo, surf
- **Bienestar y mente-cuerpo** — yoga, meditación, taichí, pilates
- **Campeonato y liga** — final, eliminatoria, gran premio

### 5. Gastronomía `#E6C44F` (finanzas → gastronomía)

Comida y bebida como evento. Distinto del POI «restauración» que es un local fijo.

- **Cata y degustación** — vino, cerveza artesana, queso, café
- **Festival gastronómico** — feria, ruta de tapas, semana del producto
- **Mercadillo gastro** — food truck, mercado de productores, market

### 6. Infancia y familia `#7AA0C2` (agua → familia)

Eventos pensados específicamente para niños y adultos acompañándolos.

- **Espectáculo infantil** — cuentacuentos, títeres, magia, teatro infantil
- **Taller infantil** — manualidades, ciencia, naturaleza, arte
- **Parque y atracción** — feria, parque temático estacional

### 7. Fiestas y tradición `#C85438` (accent → fiesta)

Celebraciones de raíz cultural o religiosa con calendario fijo o variable.

- **Patronal** — fiesta del pueblo, día del patrón
- **Carnaval** — gala, mogollón, entierro de la sardina
- **Romería y verbena** — procesión, baile, hoguera
- **Conmemoración** — día de Canarias, fiestas fundacionales

### 8. Institucional `#A06544` (publico → institucional)

Comunicación oficial de instituciones a ciudadanos. La capa que convierte la app en infraestructura.

- **Pleno y sesión** — pleno municipal, junta de distrito, comisión
- **Información y consulta** — sesión informativa, exposición pública
- **Convocatoria** — plazo de subvención, oposición, beca, concurso
- **Anuncio oficial** — bando, comunicado, alerta meteorológica

## Eje temporal (independiente de la categoría)

- **Puntual** — un único momento, sin repetición prevista
- **Recurrente** — se repite con un patrón (semanal, mensual, anual)
- **En curso** — ya está pasando ahora mismo (rango de fechas activo)
- **Próximamente** — anunciado pero sin fecha precisa todavía
- **Permanente** — el evento se mantiene indefinidamente (tipo «exposición permanente»)

## Eje de acceso (independiente de la categoría)

- **Libre** — entrada gratuita, sin inscripción
- **Inscripción previa** — requiere apuntarse aunque sea gratis
- **Con entrada** — hay que pagar
- **Profesional** — restringido a profesionales o gremios específicos
- **Restringido** — solo para vecinos registrados, miembros de una asociación, etc.

## Esquema de un Feature de evento

Cada evento, una vez geocodeado, se almacena como una Feature GeoJSON con properties estandarizadas:

```json
{
  "type": "Feature",
  "geometry": {"type": "Point", "coordinates": [lng, lat]},
  "properties": {
    "id": "evt_<hash>",
    "title": "<string>",
    "description": "<string, opcional>",
    "category_l1": "cultura|comunidad|educacion|deporte|gastronomia|familia|fiesta|institucional",
    "category_l2": "<subcategoría según L1>",
    "temporality": "puntual|recurrente|en_curso|proximamente|permanente",
    "access": "libre|inscripcion|con_entrada|profesional|restringido",
    "starts_at": "<ISO datetime>",
    "ends_at": "<ISO datetime, opcional>",
    "recurrence": "<RFC5545 RRULE, opcional>",
    "venue": "<nombre del local>",
    "building_id": "<id en buildings.geojson, si geocodea>",
    "manzana_id": "<id en manzanas.geojson, si geocodea>",
    "section_cusec": "<cusec, si geocodea>",
    "organizer": "<string>",
    "organizer_kind": "particular|colectivo|empresa|institucion",
    "organizer_verified": "<bool, true si cuenta institucional verificada>",
    "source": "<nombre fuente>",
    "source_url": "<URL>",
    "price": "<gratis|<float>€|donativo>",
    "audience": "<edad recomendada o público objetivo>",
    "tags": ["<libres>"],
    "ingested_at": "<ISO datetime>",
    "expires_at": "<ISO datetime, para limpieza>"
  }
}
```

## Reglas de overlap y categorización

- Un evento puede tener UNA sola `category_l1` y UNA sola `category_l2`. Si encaja en varias, se elige la dominante por intención del organizador.
- Si un concierto es además benéfico → `cultura/musica` con tag `benefico` y `causa_social=true`. No es comunidad.
- Si un taller forma parte de un festival cultural más grande → el taller es `educacion/taller`, el festival es `cultura/festival`. Se enlazan por `parent_event_id`.
- Los eventos institucionales tienen prioridad de visualización: si un pleno y un concierto coinciden en hora y manzana, el pleno se muestra antes en la lista.
- Eventos sin geocoding firme se asignan a la sección por bbox aproximado y se marcan `geocoding_quality: "low"` para revisión manual.

## Próximos pasos sobre la taxonomía

- Validar con dos o tres asociaciones vecinales locales si las subcategorías de Comunidad capturan lo que ellos hacen.
- Añadir un modo «evento privado» con visibilidad restringida a manzana o barrio para que vecinos puedan organizar cosas sin que aparezcan en el feed público.
- Decidir si los anuncios comerciales (rebajas, ofertas) entran como subcategoría de Comercio o quedan fuera de la app deliberadamente para no convertirla en escaparate.
