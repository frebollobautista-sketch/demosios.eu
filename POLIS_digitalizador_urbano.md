# POLIS — Digitalizador Urbano
## Documento de concepto, resultados de ejercicio e integración con Cowork
**Carpeta:** KOINOS  
**Estado:** Borrador / exploración activa  
**Fecha:** Abril 2026  
**Autor:** Sesión Claude × usuario

---

## 1. Qué es POLIS y de dónde viene esta idea

POLIS es la capa de mapeo urbano del proyecto. Su función central es convertir el espacio físico de una ciudad —sus fachadas, materiales, texturas, geometría— en un espacio digital navegable, jugable o analizable.

Este documento nace de un ejercicio práctico: construir un calibrador de densidad pixel art que permita, foto a foto, encontrar los parámetros visuales exactos que definen el estilo de un espacio urbano concreto. El resultado no es solo estético: es un conjunto de parámetros técnicos exportables directamente a Godot como GDScript, o a cualquier motor que use tiles y paletas de color.

La pregunta de fondo es: **¿se puede digitalizar una ciudad con el nivel de detalle suficiente para construir un espacio interactivo fiel a ella?** La respuesta, después del ejercicio, es sí, y con herramientas que ya existen o están al alcance de ser construidas.

---

## 2. Resultados del ejercicio: el calibrador de densidad pixel art

### Qué se construyó

Una herramienta interactiva en el navegador con las siguientes capacidades:

- Carga de imágenes propias (fotos de fachadas, calles, materiales)
- Cuatro parámetros calibrables en tiempo real:
  - **Tamaño de píxel** (1–32 px): controla la granularidad, es decir, cuánto detalle se pierde o se retiene
  - **Número de colores** (2–64): cuántos tonos distintos componen la paleta resultante
  - **Contraste** (50–200%): amplifica o reduce la diferencia entre zonas claras y oscuras
  - **Saturación** (0–200%): intensidad cromática del resultado
- Vista comparativa original / pixel art en tiempo real
- Extracción automática de paleta de colores (algoritmo k-means)
- Métricas calculadas: tiles únicos estimados, resolución pixel art, densidad de información
- Sistema de guardado de mediciones por imagen, con nombre personalizado
- Exportación a GDScript (Godot 4) y JSON

### Qué aprendimos técnicamente

El parámetro más determinante no es el tamaño de píxel sino la **combinación entre tamaño de píxel y número de colores**. Un píxel grande con muchos colores da resultados difusos. Un píxel pequeño con pocos colores da resultados muy estilizados y coherentes. La zona de máxima expresividad pixel art suele estar entre 4–10 px de tamaño y 8–24 colores.

El contraste y la saturación son parámetros de *carácter*: definen si el resultado es cálido o frío, dramático o suave, sin cambiar la estructura del píxel.

---

## 3. El concepto de perfil por material (no por foto)

### Por qué es importante

Una fachada no es un material uniforme. Tiene paredes, ventanas, balcones, molduras, puertas. Si calibras el pixel art sobre la foto completa, el algoritmo promedia todo y el resultado no representa fielmente ningún elemento.

La solución es crear **perfiles de material**: cada perfil describe los parámetros pixel art de una superficie específica, no de una foto completa.

### Estructura de un perfil de material

```
Nombre: piedra_volcanica_canaria
Tamaño de píxel: 8–10 px
Colores: 6–8
Contraste: 130–150%
Saturación: 40–60%
Carácter: oscuro, rugoso, poca variación cromática
Referencia visual: muros de basalto, mampostería tradicional canaria
```

```
Nombre: madera_tea
Tamaño de píxel: 5–7 px
Colores: 10–14
Contraste: 140–160%
Saturación: 80–100%
Carácter: cálido, con veta, alto contraste longitudinal
Referencia visual: balcones, carpinterías interiores, techos
```

```
Nombre: encalado_blanco
Tamaño de píxel: 6–8 px
Colores: 4–6
Contraste: 80–100%
Saturación: 20–40%
Carácter: plano, luminoso, casi sin textura
Referencia visual: paredes exteriores, patios, fachadas coloniales
```

```
Nombre: azulejo_hidraulico
Tamaño de píxel: 2–4 px
Colores: 16–24
Contraste: 110–130%
Saturación: 120–160%
Carácter: geométrico, denso, colores vivos
Referencia visual: suelos, zócalos, patios andaluces y canarios
```

### Ventaja para Godot

Con 8–12 perfiles de material, el motor puede construir cualquier fachada de la ciudad combinando tiles de forma procedural, exactamente como funcionan los tilesets en juegos 2D. Cada material tiene su propia paleta y densidad, y se aplican por zona según la segmentación de la imagen de origen.

---

## 4. Viabilidad técnica: pipeline completo de digitalización urbana

### Fuentes de datos disponibles

**Google Street View API**
Permite descargar imágenes de cualquier punto de la ciudad con orientación, FOV y resolución controlables. La cobertura en España es prácticamente total. Es la fuente más rica para fachadas a nivel de calle.

**OpenStreetMap + Overpass API**
Datos vectoriales de edificios: número de plantas, tipo de uso, año de construcción, materiales declarados. Permite saber *qué* hay antes de fotografiarlo. Gratuito y de acceso abierto.

**Catastro (España)**
Geometría de parcelas y edificios con alturas. Complementa OSM con datos oficiales. API pública del Ministerio de Hacienda.

**Fotogrametría propia**
Con un smartphone y apps como Polycam o RealityCapture (móvil), se puede reconstruir la geometría 3D de una fachada a partir de 20–30 fotos. El resultado es una malla 3D texturizada que luego se puede "aplanar" como sprite o tile.

**NotebookLM como capa de conocimiento**
NotebookLM no da acceso directo a bases de datos externas, pero sí puede funcionar como repositorio estructurado de los resultados del calibrador: si se le pasan los JSON exportados por el calibrador (uno por sesión de fotos), puede responder preguntas sobre los estilos definidos, comparar perfiles, sugerir combinaciones. Claude en Cowork puede leer esos mismos archivos JSON desde la carpeta KOINOS y usarlos como base de datos de estilos para cualquier tarea posterior.

### Pipeline propuesto para POLIS

```
1. CAPTURA
   Street View API / foto propia / fotogrametría
   → imagen de fachada o calle

2. SEGMENTACIÓN
   Modelo de visión (SAM de Meta, o GroundingDINO)
   → máscaras por zona: pared / ventana / balcón / puerta / cubierta

3. CALIBRACIÓN
   Herramienta calibrador (ya construida)
   → perfil de material por zona
   → parámetros: píxel size, colores, contraste, saturación

4. GENERACIÓN DE TILESET
   Script Python: aplica parámetros por zona → genera tiles pixel art
   → tileset .png compatible con Godot / Tiled

5. GODOT
   GDScript generado por el calibrador
   → TileMap con los materiales definidos
   → nivel jugable ambientado en la ciudad real

6. KOINOS / POLIS
   JSON de estilos guardado en carpeta KOINOS
   → Claude Cowork puede leerlo y usarlo en futuras tareas
   → NotebookLM puede responder preguntas sobre el corpus de estilos acumulado
```

---

## 5. Integración con Cowork

Claude Cowork puede leer archivos de la carpeta KOINOS directamente. Para que este proyecto funcione dentro de Cowork, se propone la siguiente estructura de archivos:

```
KOINOS/
├── POLIS_digitalizador_urbano.md     ← este archivo (concepto e instrucciones)
├── estilos/
│   ├── pixel_art_styles.json         ← exportado por el calibrador, sesión a sesión
│   └── materiales_base.json          ← perfiles de material canónicos (piedra, madera, etc.)
├── godot/
│   └── pixel_art_styles.gd           ← GDScript exportado por el calibrador
└── referencias/
    └── fotos_calibradas/             ← miniaturas de las fotos con sus parámetros anotados
```

Cuando Claude Cowork acceda a KOINOS y encuentre este archivo, sabrá que:

- POLIS es el módulo de mapeo urbano
- El calibrador genera JSON con perfiles de material
- Los perfiles se usan para generar tilesets y scripts Godot
- El objetivo final es construir un espacio digital fiel a una ciudad real

### Instrucción para Cowork

> Cuando trabajes en tareas relacionadas con POLIS o el digitalizador urbano, lee primero `KOINOS/estilos/pixel_art_styles.json` y `KOINOS/estilos/materiales_base.json`. Esos archivos contienen los parámetros de estilo pixel art calibrados sobre fotos reales. Úsalos como referencia para cualquier generación de assets, scripts Godot, o análisis de coherencia visual.

---

## 6. Sobre NotebookLM y el acceso a bases de datos de imágenes urbanas

NotebookLM no puede acceder a APIs externas ni descargar imágenes en tiempo real. Su fortaleza es otra: procesar y hacer consultable un corpus de documentos que tú le aportas.

El flujo recomendado para alimentarlo es:

1. Exportar los JSON del calibrador después de cada sesión de fotos
2. Añadir un documento de texto por cada sesión describiendo el contexto (barrio, tipo de edificio, época, materiales observados)
3. Subir ambos a NotebookLM como fuentes
4. NotebookLM podrá entonces responder preguntas como "¿qué perfil de color usamos para fachadas coloniales?" o "¿en qué barrios usamos píxel más pequeño?"

Para acceso real a imágenes de calles, la vía es la Google Street View Static API (de pago, pero con créditos gratuitos) o la Mapillary API (open source, gratuita, con imágenes geolocalizadas de voluntarios). Ambas se pueden integrar en un script Python que descargue imágenes por coordenadas y las pase al pipeline de segmentación y calibración.

---

## 7. Próximos pasos concretos

En orden de menor a mayor complejidad técnica:

1. **Inmediato**: usar el calibrador ya construido con 5–10 fotos propias. Exportar el JSON. Guardarlo en KOINOS/estilos/.

2. **Corto plazo**: definir los 8–12 perfiles de material canónicos para el contexto urbano elegido (Las Palmas, o cualquier ciudad de referencia). Guardarlos como `materiales_base.json`.

3. **Medio plazo**: construir en Godot un TileMap de prueba usando el GDScript exportado. Verificar que los parámetros generan assets visualmente coherentes.

4. **Más adelante**: integrar la Street View API o Mapillary para automatizar la captura. Añadir segmentación por zonas con un modelo de visión ligero.

5. **Visión**: POLIS como módulo de Cowork que, dada una dirección o zona de la ciudad, genera automáticamente un tileset pixel art y un fragmento de nivel Godot ambientado en ese lugar.

---

## 8. Notas de concepto (para guardar como boceto)

El digitalizador no es un escáner. No intenta reproducir la ciudad con fidelidad fotográfica. Intenta **traducirla** a un lenguaje visual que tenga sus propias reglas: el pixel art. Esa traducción implica decisiones estéticas —cuánto detalle, qué colores, qué carácter— que son exactamente lo que el calibrador ayuda a tomar de forma consciente y reproducible.

La ciudad resultante no es una copia. Es una interpretación. Y esa interpretación puede ser más expresiva, más jugable, más habitable digitalmente que una reproducción exacta. POLIS no es Google Maps con filtro pixel art. Es una ciudad reimaginada con sus propias reglas, construida desde el conocimiento de la ciudad real.

Esa diferencia es la que hace que valga la pena.

---

*Documento generado en sesión Claude / Cowork — Carpeta KOINOS — Proyecto POLIS*  
*Próxima revisión: cuando se completen las primeras 5 mediciones del calibrador*
