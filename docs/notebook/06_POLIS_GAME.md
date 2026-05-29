# POLIS GAME — La ciudad como tablero

> "Camina por tu ciudad. Desbloquea su historia. Contribuye a su capa digital."

**Estado:** Diseño activo  
**Fecha:** Abril 2026  
**Dependencias:** Blender GIS (datos fuente), POLIS mode (UI), pipeline pixel art (estilos)

---

## 1. Concepto central

POLIS GAME convierte los datos urbanísticos reales de Las Palmas de Gran Canaria — extraídos de GIS e importados a Blender — en una experiencia de exploración y contribución dentro de KOINOS. No es un juego separado: es la capa de gamificación que da vida al modo POLIS.

La analogía con Pokemon Go es estructural, no estética: en Pokemon Go, Niantic extrajo datos de Ingress (portales geolocalizados) y los convirtió en puntos de interés descubribles. Aquí, extraemos datos GIS (geometría de edificios, parcelas, alturas, usos) y los convertimos en **paquetes urbanos descubribles**.

La diferencia fundamental: en Pokemon Go coleccionas criaturas ficticias. En POLIS coleccionas **conocimiento real** sobre tu ciudad, y puedes **enriquecerlo**.

---

## 2. Pipeline de datos: de Blender GIS a paquetes jugables

### 2.1 Fuente: datos GIS en Blender

Los datos GIS importados a Blender contienen:

- **Geometría de edificios**: footprint (huella en planta), altura estimada, volumen
- **Parcelas catastrales**: límites, referencia catastral, superficie
- **Vías y espacios públicos**: calles, plazas, parques
- **Metadatos**: uso (residencial, comercial, dotacional), año de construcción (cuando existe), número de plantas

Estos datos vienen típicamente de OpenStreetMap (via blender-osm o blosm) y/o del Catastro español (INSPIRE WFS). En Blender aparecen como mallas con propiedades custom.

### 2.2 Exportación: Blender → GeoJSON enriquecido

Script de Blender (Python) que:

1. Recorre todos los objetos de la escena con propiedad `building=yes` o equivalente
2. Extrae: centroide (lat/lng), footprint simplificado, altura, metadatos disponibles
3. Agrupa por **zona** (ver §3)
4. Exporta un `.geojson` por zona con propiedades extendidas

Formato de salida por edificio:

```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "properties": {
    "id": "vegueta-b-0042",
    "name": null,
    "zona": "vegueta",
    "altura_m": 9.2,
    "plantas": 3,
    "uso": "residencial",
    "año": null,
    "materiales_estimados": ["encalado_blanco", "madera_tea"],
    "landmark": false,
    "calibrado": false
  }
}
```

### 2.3 Enriquecimiento: landmarks conocidos

Los edificios que ya tienen ficha (Mercado de Vegueta, Catedral de Santa Ana, Casa de Colón...) se cruzan por coordenadas con los datos GIS y se marcan como `landmark: true` con datos adicionales de `las-palmas-data.ts` y `mercado_vegueta.json`.

### 2.4 Resultado: carpeta de paquetes

```
KOINOS/
├── polis-data/
│   ├── zonas.geojson          ← polígonos de las zonas (Vegueta, Triana, etc.)
│   ├── vegueta/
│   │   ├── edificios.geojson  ← todos los edificios de la zona
│   │   ├── landmarks.json     ← fichas enriquecidas de landmarks
│   │   └── meta.json          ← stats de zona: total edificios, calibrados, etc.
│   ├── triana/
│   │   └── ...
│   ├── las-canteras/
│   │   └── ...
│   └── el-confital/
│       └── ...
```

---

## 3. Zonificación: cómo se trocea la ciudad

### 3.1 Jerarquía de tres niveles

| Nivel | Nombre | Escala | Ejemplo |
|-------|--------|--------|---------|
| **Distrito** | El contenedor mayor | ~2-5 km² | Vegueta-Triana, Ciudad Alta, Puerto-Canteras |
| **Zona** | Unidad jugable principal | ~0.2-0.5 km² | Vegueta, Triana, Plaza del Pilar, El Confital |
| **Célula** | Manzana o grupo de edificios | ~50-100 edificios | Manzana de la Catedral, Manzana del Mercado |

### 3.2 Zonas iniciales (piloto Las Palmas)

Basándose en los `PIN_COORDS` y `LANDMARKS` que ya existen en el código:

1. **Vegueta** — Centro histórico. Catedral, Casa de Colón, Mercado, Teatro Pérez Galdós. La zona más densa en patrimonio. ~200 edificios.
2. **Triana** — Eje comercial histórico. Calle Mayor de Triana, Gabinete Literario. ~180 edificios.
3. **Las Canteras** — Frente marítimo. Playa, Auditorio Alfredo Kraus, Paseo. ~150 edificios.
4. **Puerto-Santa Catalina** — Zona portuaria. Castillo de La Luz, Parque Santa Catalina. ~120 edificios.
5. **El Confital** — Borde natural. Playa salvaje, acantilados. Menos edificios (~40), más paisaje.

### 3.3 Estado de una zona

Cada zona tiene un **porcentaje de completado** basado en:

- Edificios **descubiertos** (el usuario caminó cerca): peso 30%
- Edificios **identificados** (el usuario tocó el pin y leyó la ficha): peso 20%
- Edificios **calibrados** (alguien subió foto + perfil pixel art): peso 50%

Una zona "completada" al 100% significa que todos sus edificios tienen nombre, ficha, y perfil de materiales calibrado. Eso es imposible que lo haga una sola persona — requiere contribución colectiva.

---

## 4. Mecánicas de juego

### 4.1 Descubrir (pasivo — caminar)

El usuario abre POLIS y camina por la ciudad. Cuando entra en el radio de una **célula** (manzana), los edificios de esa célula se **revelan** en el mapa — pasan de siluetas grises a formas con color. Es como la "niebla de guerra" de los juegos de estrategia.

Técnicamente: geofencing por coordenadas del dispositivo vs centroides de células. Radio de activación: 50-100 metros.

**Recompensa**: los edificios descubiertos aparecen en tu **colección** (una especie de álbum, conectado con TOUCH). Ganas puntos de exploración.

### 4.2 Identificar (activo — tocar)

El usuario toca un edificio descubierto y ve su ficha:

- Si es un **landmark** con datos: ficha completa (año, arquitecto, materiales, historia)
- Si es un **edificio anónimo**: ficha parcial con los datos GIS (altura, plantas, uso)

El usuario puede **nombrar** un edificio anónimo si lo conoce (el nombre entra en cola de validación comunitaria via semáforo/PEC). Un edificio identificado por la comunidad vale más que uno solo descubierto.

**Recompensa**: insignia de "conocedor del barrio". Los edificios que tú nombraste llevan tu PEC.

### 4.3 Calibrar (contribución — fotografiar)

La mecánica más valiosa. El usuario saca una foto de la fachada de un edificio y entra en el **modo calibrador** (el que ya se diseñó en `POLIS_digitalizador_urbano.md`):

1. Saca foto → la app detecta el edificio más cercano
2. Selecciona zona de la fachada (pared, ventana, puerta, balcón)
3. Calibra los 4 parámetros (pixel size, colores, contraste, saturación)
4. Guarda → el perfil de material se asocia al edificio
5. El edificio pasa de "silueta con color" a "representación pixel art calibrada"

**Recompensa**: el calibrador más activo de una zona gana el título de "Arquitecto digital de [zona]". La calibración es permanente (revisable pero no borrable) y lleva el PEC del autor.

### 4.4 Completar (colectivo — zona)

Cuando una zona alcanza umbrales de completado, se desbloquean vistas especiales:

- **50% descubierta**: se activa la vista "mapa pixel art" de esa zona (tiles generados)
- **75% calibrada**: se desbloquea la vista 3D de la zona (geometría Godot con materiales reales)
- **100% calibrada**: la zona se convierte en "zona patrimonio digital" — monumento comunitario

Estos umbrales son colectivos: no es un jugador solo, es toda la comunidad de POLIS en esa zona.

---

## 5. La colección: qué acumulas

### 5.1 Edificios

Tu álbum de edificios descubiertos / identificados / calibrados. Cada uno muestra:

- Silueta pixel art (generada con los parámetros calibrados, o placeholder si no está calibrado)
- Nombre (si existe)
- Zona y célula
- Tu relación: descubierto / identificado / calibrado por ti
- Número de PECs que tiene de otros usuarios

### 5.2 Materiales

Al calibrar, descubres materiales. Tu colección de materiales muestra cuántas veces has encontrado cada tipo (piedra volcánica, madera de tea, encalado, azulejo hidráulico...) y en qué edificios. Es como un "Pokédex de materiales urbanos".

### 5.3 Zonas

Cada zona tiene su tarjeta con:

- Porcentaje de completado (personal y colectivo)
- Mapa miniatura con lo que has descubierto
- Ranking de contribuidores de esa zona

### 5.4 Insignias

| Insignia | Cómo se obtiene |
|----------|----------------|
| Explorador/a de [zona] | Descubrir 50%+ de edificios de una zona |
| Conocedor/a de [zona] | Identificar 20+ edificios con nombre |
| Arquitecto/a digital | Calibrar 10+ edificios con fotos propias |
| Ojo de piedra | Encontrar piedra volcánica en 5+ edificios |
| Ojo de tea | Encontrar madera de tea en 5+ edificios |
| Vecino/a útil | Recibir 10+ PECs en tus contribuciones |
| Cartógrafo/a | Descubrir edificios en 3+ zonas distintas |
| Primer calibrador | Ser el primero en calibrar un edificio |

---

## 6. Integración técnica en KOINOS/POLIS

### 6.1 Dentro del modo POLIS existente

POLIS ya tiene 4 medallas: Mapear, Peticionar, Ocupación, Ventanilla.

La experiencia de juego vive dentro de **Mapear**. No es una medalla nueva — es la evolución de Mapear de "mapa estático con pines" a "mapa vivo con capa de descubrimiento".

### 6.2 Flujo de usuario

```
KOINOS → POLIS → Mapear
                    │
                    ├─ Vista mapa (Leaflet con tiles OSM)
                    │   ├─ Capa 1: Zonas (polígonos coloreados por % completado)
                    │   ├─ Capa 2: Edificios (siluetas del GIS, coloreadas por estado)
                    │   ├─ Capa 3: Landmarks (pines especiales con icono)
                    │   └─ Capa 4: Tu posición (geolocalización)
                    │
                    ├─ Vista colección (tu álbum de edificios/materiales/insignias)
                    │
                    └─ Modo calibrador (cámara → calibrar → guardar)
```

### 6.3 Modelo de datos

```typescript
// Zona: unidad principal de gamificación
type PolisZone = {
  id: string;                    // "vegueta"
  name: string;                  // "Vegueta"
  polygon: [number, number][];   // contorno GeoJSON
  district: string;              // "vegueta-triana"
  stats: {
    totalBuildings: number;
    discovered: number;
    identified: number;
    calibrated: number;
  };
};

// Edificio: unidad atómica de la capa digital
type PolisBuilding = {
  id: string;                    // "vegueta-b-0042"
  zoneId: string;
  centroid: [number, number];
  footprint: [number, number][]; // polígono simplificado
  heightM: number;
  floors: number;
  use: 'residencial' | 'comercial' | 'dotacional' | 'mixto' | 'desconocido';
  yearBuilt: number | null;
  
  // Estado de gamificación
  landmark: boolean;
  name: string | null;
  namedBy: string | null;        // userId del que lo nombró
  
  // Calibración pixel art
  calibrated: boolean;
  materials: MaterialProfile[];
  calibratedBy: string | null;
  calibratedAt: string | null;
  
  // Social
  pecCount: number;
  discoveredByCount: number;
};

// Perfil de material calibrado por foto
type MaterialProfile = {
  zone: 'pared' | 'ventana' | 'puerta' | 'balcon' | 'cubierta' | 'zocalo';
  materialId: string;            // "piedra_volcanica_canaria"
  params: {
    pixelSize: number;
    colors: number;
    contrastPct: number;
    saturationPct: number;
  };
  photoUrl: string | null;
  authorId: string;
};

// Progreso del jugador
type PlayerProgress = {
  userId: string;
  discoveredBuildings: string[];  // building ids
  identifiedBuildings: string[];
  calibratedBuildings: string[];
  materialsFound: Record<string, number>; // materialId → count
  badges: Badge[];
  zonesProgress: Record<string, {
    discovered: number;
    identified: number;
    calibrated: number;
  }>;
};
```

### 6.4 Supabase schema (extensión del existente)

```sql
-- Zonas de la ciudad
CREATE TABLE polis_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  polygon JSONB NOT NULL,  -- GeoJSON polygon
  total_buildings INT DEFAULT 0,
  discovered_count INT DEFAULT 0,
  identified_count INT DEFAULT 0,
  calibrated_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Edificios (importados del GIS)
CREATE TABLE polis_buildings (
  id TEXT PRIMARY KEY,
  zone_id TEXT REFERENCES polis_zones(id),
  centroid GEOGRAPHY(POINT, 4326),
  footprint JSONB,
  height_m REAL,
  floors INT,
  use TEXT DEFAULT 'desconocido',
  year_built INT,
  is_landmark BOOLEAN DEFAULT false,
  name TEXT,
  named_by UUID REFERENCES auth.users(id),
  calibrated BOOLEAN DEFAULT false,
  calibrated_by UUID REFERENCES auth.users(id),
  calibrated_at TIMESTAMPTZ,
  pec_count INT DEFAULT 0,
  discovered_by_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Calibraciones de material (una por zona de fachada)
CREATE TABLE polis_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id TEXT REFERENCES polis_buildings(id),
  facade_zone TEXT NOT NULL, -- pared, ventana, puerta, balcon, cubierta, zocalo
  material_id TEXT NOT NULL, -- piedra_volcanica_canaria, etc.
  pixel_size INT,
  colors INT,
  contrast_pct INT,
  saturation_pct INT,
  photo_url TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Progreso del jugador
CREATE TABLE polis_player_progress (
  user_id UUID REFERENCES auth.users(id),
  building_id TEXT REFERENCES polis_buildings(id),
  status TEXT CHECK (status IN ('discovered', 'identified', 'calibrated')),
  discovered_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, building_id)
);

-- Insignias
CREATE TABLE polis_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  badge_type TEXT NOT NULL,
  zone_id TEXT REFERENCES polis_zones(id),
  earned_at TIMESTAMPTZ DEFAULT now()
);

-- Índice geoespacial para descubrimiento por proximidad
CREATE INDEX idx_buildings_centroid ON polis_buildings USING GIST(centroid);
```

---

## 7. Pipeline GIS → Paquetes: script de exportación Blender

### 7.1 Qué hace el script

```python
# blender_export_polis.py — ejecutar dentro de Blender
# 
# Lee la escena GIS importada, extrae edificios con sus propiedades,
# los agrupa por zona, y exporta GeoJSON + meta.json por zona.
#
# Prerrequisitos:
# - Datos GIS importados en Blender (via blosm, blender-osm, o similar)
# - Cada objeto tiene custom properties: building, height, etc.
# - Un objeto "zonas" con polígonos que definen las zonas de la ciudad

import bpy
import json
import os
from mathutils import Vector

OUTPUT_DIR = "/ruta/a/KOINOS/polis-data"

# Las zonas se definen como polígonos en un objeto de Blender
# o se calculan agrupando por proximidad
ZONE_DEFINITIONS = {
    "vegueta": { "center": (28.1003, -15.4139), "radius_km": 0.4 },
    "triana": { "center": (28.1037, -15.4156), "radius_km": 0.3 },
    "las-canteras": { "center": (28.135, -15.4367), "radius_km": 0.5 },
    "puerto-santa-catalina": { "center": (28.1415, -15.4295), "radius_km": 0.3 },
    "el-confital": { "center": (28.1481, -15.4503), "radius_km": 0.3 },
}

def export_buildings():
    """Recorre objetos de Blender y exporta como GeoJSON por zona."""
    buildings_by_zone = {z: [] for z in ZONE_DEFINITIONS}
    
    for obj in bpy.data.objects:
        if not obj.get("building"):
            continue
        
        # Extraer centroide (convertir de coordenadas Blender a lat/lng)
        # Esto depende del addon GIS usado — adaptar según el caso
        lat = obj.get("latitude", obj.location.y)
        lng = obj.get("longitude", obj.location.x)
        height = obj.get("height", obj.dimensions.z)
        
        # Asignar a zona por proximidad
        zone_id = classify_zone(lat, lng)
        if not zone_id:
            continue
        
        building = {
            "type": "Feature",
            "geometry": {
                "type": "Point",  # simplificado; con footprint sería Polygon
                "coordinates": [lng, lat]
            },
            "properties": {
                "id": f"{zone_id}-b-{len(buildings_by_zone[zone_id]):04d}",
                "zona": zone_id,
                "altura_m": round(height, 1),
                "plantas": obj.get("building:levels", estimate_floors(height)),
                "uso": obj.get("building:use", "desconocido"),
                "año": obj.get("start_date", None),
                "landmark": False,
                "calibrado": False,
                "materiales_estimados": estimate_materials(obj)
            }
        }
        buildings_by_zone[zone_id].append(building)
    
    # Exportar
    for zone_id, buildings in buildings_by_zone.items():
        zone_dir = os.path.join(OUTPUT_DIR, zone_id)
        os.makedirs(zone_dir, exist_ok=True)
        
        geojson = {
            "type": "FeatureCollection",
            "features": buildings
        }
        
        with open(os.path.join(zone_dir, "edificios.geojson"), "w") as f:
            json.dump(geojson, f, indent=2, ensure_ascii=False)
        
        meta = {
            "zona": zone_id,
            "total_edificios": len(buildings),
            "descubiertos": 0,
            "identificados": 0,
            "calibrados": 0,
            "exportado": "2026-04-19"
        }
        
        with open(os.path.join(zone_dir, "meta.json"), "w") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

def classify_zone(lat, lng):
    """Asigna un edificio a la zona más cercana."""
    from math import radians, cos, sin, sqrt, atan2
    best = None
    best_dist = float('inf')
    for zone_id, zone in ZONE_DEFINITIONS.items():
        clat, clng = zone["center"]
        # Haversine simplificado
        dlat = radians(lat - clat)
        dlng = radians(lng - clng)
        a = sin(dlat/2)**2 + cos(radians(clat)) * cos(radians(lat)) * sin(dlng/2)**2
        d = 2 * atan2(sqrt(a), sqrt(1-a)) * 6371  # km
        if d < zone["radius_km"] and d < best_dist:
            best = zone_id
            best_dist = d
    return best

def estimate_floors(height_m):
    """Estima plantas a partir de altura (3m por planta)."""
    return max(1, round(height_m / 3.0))

def estimate_materials(obj):
    """Estima materiales a partir de las propiedades del objeto."""
    materials = []
    height = obj.get("height", 0)
    use = obj.get("building:use", "")
    
    # Heurísticas canarias básicas
    materials.append("encalado_blanco")  # casi todo tiene encalado
    if height > 5:
        materials.append("tejado_teja_arabe")
    if use in ("historic", "church", "civic"):
        materials.append("piedra_volcanica_canaria")
    if height > 3:
        materials.append("madera_tea")  # balcones
    
    return materials

if __name__ == "__main__":
    export_buildings()
    print(f"Exportado a {OUTPUT_DIR}")
```

### 7.2 Adaptación necesaria

El script anterior es un esqueleto. Lo que hay que adaptar depende de cómo llegaron los datos GIS a Blender:

- Si usaste **blosm** (blender-osm): los objetos tienen propiedades OSM como `building`, `building:levels`, `addr:street`
- Si importaste desde **Catastro INSPIRE**: tendrás referencia catastral y altura oficial
- Si la geometría viene de **fotogrametría**: solo tendrás mallas sin metadatos, hay que cruzar con OSM por coordenadas

---

## 8. Relación con el pipeline pixel art existente

El pipeline del `POLIS_digitalizador_urbano.md` se integra así:

```
Datos GIS (Blender) ──┐
                       ├── POLIS GAME (descubrir / identificar)
Landmarks conocidos ───┘
                       │
                       ▼
              Edificio sin calibrar
                       │
            [usuario saca foto]
                       │
                       ▼
              Calibrador pixel art ──── materiales_base.json
                       │
                       ▼
              MaterialProfile guardado
                       │
                       ├── Edificio calibrado en la base de datos
                       ├── Tileset generado para vista pixel art del mapa
                       └── Geometría Godot actualizada con materiales reales
```

El Mercado de Vegueta (`godot/mercado_vegueta/`) es el primer edificio completamente calibrado. Sirve como **ejemplo de qué aspecto tiene un edificio 100% completado**.

---

## 9. Vista de prototipo: cómo se ve en POLIS

### 9.1 Mapa base

Mapa Leaflet con tiles OSM centrado en Las Palmas. Sobre él:

- **Zonas** como polígonos semi-transparentes coloreados por progreso:
  - Gris: < 25% descubierta
  - Azul claro (#3DBBF0 40%): 25-50% descubierta
  - Azul (#3DBBF0): 50-75%
  - Azul intenso: 75-99%
  - Dorado (#D4AF37): 100% completada

- **Edificios** como mini-polígonos sobre el mapa:
  - Gris oscuro: no descubierto (solo visible como silueta si la zona está revelada)
  - Blanco con borde: descubierto
  - Color del material dominante: calibrado
  - Estrella dorada: landmark

- **Tu posición**: punto pulsante con radio de descubrimiento

### 9.2 Ficha de edificio

Al tocar un edificio:

```
┌─────────────────────────────┐
│  Mercado de Vegueta    ⭐  │
│  1858 · Manuel de Oraá     │
│                             │
│  ┌─────────────────────┐    │
│  │   [pixel art del    │    │
│  │    edificio]        │    │
│  └─────────────────────┘    │
│                             │
│  Materiales:                │
│  🪨 Piedra volcánica (25%) │
│  🏠 Encalado blanco (50%)  │
│  🪵 Madera de tea (10%)    │
│  🏺 Azulejo hidráulico (5%)│
│  🏠 Teja árabe (5%)        │
│                             │
│  Calibrado por: panxo93     │
│  3 PECs · 47 descubrimientos│
│                             │
│  [📸 Recalibrar] [✊ PEC]  │
└─────────────────────────────┘
```

### 9.3 Vista colección

Tu perfil en POLIS muestra:

```
┌─────────────────────────────┐
│  Mi mapa digital            │
│                             │
│  Vegueta ████████░░ 78%     │
│  Triana  ███░░░░░░░ 32%     │
│  Canteras ██░░░░░░░░ 19%    │
│                             │
│  🏛️ 42 edificios descubiertos│
│  📝 12 identificados         │
│  📸 5 calibrados             │
│                             │
│  Materiales encontrados:     │
│  🪨 Piedra volcánica × 8    │
│  🏠 Encalado × 23           │
│  🪵 Madera tea × 6          │
│  🏺 Azulejo × 2             │
│                             │
│  🏅 Explorador de Vegueta   │
│  🏅 Primer calibrador       │
└─────────────────────────────┘
```

---

## 10. Fases de implementación

### Fase 1: Datos (ahora)
- [ ] Exportar datos GIS de Blender a GeoJSON por zona
- [ ] Cruzar con landmarks existentes de `las-palmas-data.ts`
- [ ] Crear estructura `polis-data/` con las 5 zonas piloto
- [ ] Validar que las coordenadas y geometrías son correctas

### Fase 2: Mapa vivo (siguiente)
- [ ] Cablear Leaflet en POLIS/Mapear
- [ ] Renderizar zonas como polígonos coloreados
- [ ] Renderizar edificios como siluetas en el mapa
- [ ] Geolocalización del usuario + radio de descubrimiento
- [ ] Ficha de edificio al tocar

### Fase 3: Gamificación (después)
- [ ] Mecánica de descubrimiento por proximidad
- [ ] Colección de edificios y materiales
- [ ] Insignias y progreso por zona
- [ ] Calibrador integrado (foto → perfil de material)

### Fase 4: Capa visual (futuro)
- [ ] Generar tiles pixel art por zona calibrada
- [ ] Toggle "mapa real ↔ mapa pixel art" en POLIS
- [ ] Vista 3D de edificios calibrados (integración Godot/three.js)

---

*Documento generado en sesión Claude × Pancho — KOINOS/POLIS — Abril 2026*
