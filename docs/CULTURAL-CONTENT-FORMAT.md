# Formato de contenido cultural — POLIS iso runtime

Este documento describe el mecanismo de ingesta de contenido cultural en
el visor iso. Permite añadir nuevas fuentes (eventos, productores
artesanos, rutas, sitios patrimoniales, mercadillos…) sin tocar lógica
de render — basta con un geojson que siga el esquema y una entrada de
registro en `overlays/index.js`.

## Estructura general

Cada fuente vive en un archivo geojson dentro de `public/data/`:

```
public/data/
├── events-cultural.geojson     # eventos puntuales (fecha + hora)
├── productores-locales.geojson # productores permanentes
└── …                            # añadir aquí
```

El runtime no procesa los archivos en bulk; cada uno lo consume un
overlay específico en `public/polis-app/overlays/<id>.js`. Esto permite:
- Distintos esquemas de propiedades por tipo de contenido
- Iconografía y popup adaptados a cada tipo
- Activación/desactivación independiente desde el panel de capas
- Priorización en el buscador (typeBonus en `search.js`)

## Esquema mínimo (común a todos los tipos)

```json
{
  "type": "FeatureCollection",
  "_meta": {
    "fuente": "URL o nombre del origen — quién publicó/curó",
    "actualizado": "YYYY-MM-DD",
    "version": 1
  },
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [lng, lat] },
      "properties": {
        "id": "slug-unico",
        "nombre": "Nombre visible",
        "municipio": "Nombre del municipio (string libre)"
        // … campos específicos del tipo
      }
    }
  ]
}
```

Las coordenadas son `[lng, lat]` (WGS84 estándar geojson). El overlay
las convierte a metros locales usando `lnglatToLocalMeters(lng, lat,
[-15.55, 28.05])`.

## Esquemas por tipo

### Eventos culturales — `events-cultural.geojson`

```json
{
  "id": "evt-001",
  "titulo": "Concierto: «Mahler»",
  "fecha": "2026-05-12",              // YYYY-MM-DD
  "hora_inicio": "20:30",             // HH:MM, opcional
  "lugar": "Auditorio Alfredo Kraus", // nombre del venue
  "municipio": "Las Palmas de Gran Canaria",
  "categoria": "concierto",           // enum (ver paletas en eventos.js)
  "descripcion": "Texto breve para el popup."
}
```

Categorías reconocidas (paleta en `overlays/eventos.js`):
`exposicion`, `concierto`, `taller`, `festival`, `presentacion`, `evento_especial`.

### Productores locales — `productores-locales.geojson`

```json
{
  "id": "prod-001",
  "nombre": "Bodegas Los Berrazales",
  "oficio": "cafe",                   // enum (ver paletas en productores.js)
  "municipio": "Agaete",
  "que_hace": "Café del Valle de Agaete — único cafetal de Europa…"
}
```

Oficios reconocidos:
`queso`, `vino`, `cafe`, `miel`, `sidra`, `almendra`, `calado`, `sal`,
`mercadillo`, `aloe`. Para añadir un nuevo oficio, editar
`OFICIO_STYLE` en `overlays/productores.js` (fill + glifo 2-char) y la
sección CSS `.productor-popup .pp-oficio[data-o="…"]` en `style.css`.

## Cómo añadir una fuente nueva

1. **Crear el geojson** en `public/data/<nombre>.geojson` siguiendo
   el esquema mínimo + campos específicos del tipo.
2. **Crear el overlay** en `public/polis-app/overlays/<id>.js`. Copiar
   `productores.js` o `eventos.js` como punto de partida; mantener el
   contrato `{ id, name, load, isReady, draw, hitTest, getAll* }`.
3. **Registrar** en `overlays/index.js`: añadir el import, una entrada
   en `OVERLAYS` y una en `META` con su `category` y `levels`.
4. **(Opcional) Popup** específico: añadir el `<aside>` en `index.html`,
   estilos en `style.css`, y `openXxxPopup` en `app.js`. Si el contenido
   encaja con un popup existente, reutilizarlo desde `hitTest`.
5. **(Opcional) Buscador**: en `search.js · buildIndex`, añadir un bloque
   que itere los items y los empuje al array `out` con su `action`. Si la
   prioridad importa, ajustar `typeBonus` en `search`.

## Prioridad en el buscador (typeBonus)

El ranking suma un bonus por tipo además del score por coincidencia
textual. Estado actual en `search.js`:

| Tipo      | Bonus | Razón |
|-----------|-------|-------|
| productor | **5** | Prioridad explícita: pequeños agricultores y artesanos por encima de instituciones grandes |
| municipio | 3     | Identidad administrativa-cultural |
| evento    | 3     | Contenido vivo con fecha |
| distrito  | 2     | Subdivisión cívica |
| venue     | 1     | Lugar derivado, baja relevancia salvo búsqueda literal |

## Próximos pasos (no implementado)

- **Submit UI**: botón "Añadir contenido +" que abre un form de
  contribución. Requiere backend (Next.js + Supabase) — lo cubre la otra
  pieza del proyecto.
- **Validación de schema**: linter que verifique geojson contra el
  esquema antes de mergear.
- **Categorías nuevas**: rutas senderistas, BIC patrimonio, sitios
  arqueológicos, ferias. Cada una un geojson + overlay siguiendo la
  receta de arriba.
