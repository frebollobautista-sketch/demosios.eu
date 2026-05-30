# Informe 02 — Turismo y cruceros en Canarias

> Carpeta de trabajo del segundo informe de la serie OCRE foresight.
> Última actualización: 8 mayo 2026.

## Qué hay aquí

| Archivo | Para qué sirve |
|---------|----------------|
| `informe.docx` | **Informe imprimible de 5 páginas** + anexo con los 5 gráficos. Es la pieza que llevarás de referencia mientras grabas el vídeo. |
| `informe-largo.md` | Misma información en markdown editable. Fuente de verdad para futuras revisiones. |
| `guion-video.md` | **Guion de grabación** segmentado en bloques `[NARRA]`, `[PANTALLA]`, `[MEMBRETE]`, `[CLIP]`. Tabla cerrada de datos+fuente y guía operativa del chyron. |
| `graficos/` | Cinco JPG 1920×1080 listos para insertar en el vídeo. Mismos que aparecen en el anexo del docx. |

## Estructura del Word

- **Página 1**: apertura + tabla de "datos clave para tener a la vista" mientras grabas.
- **Páginas 2-5**: cuerpo del informe (turismo agregado, ola de cruceros, defensa contable, efecto fuga, todo incluido flotante, comparativa internacional, tres palancas, cierre).
- **Páginas 6-8**: anexo con los 5 gráficos a tamaño completo, uno por sección visual.
- **Página final**: bibliografía con 19 referencias.

## Gráficos disponibles

| # | Archivo | Para qué bloque del vídeo |
|---|---------|---------------------------|
| 01 | `graficos/01-pib-pc-y-salario-ccaa.jpg` | Bloque 1 — comparativa CCAA. |
| 02 | `graficos/02-cruceristas-canarias-2010-2025.jpg` | Bloque 2 — ola de cruceros. |
| 03 | `graficos/03-sankey-euro-turistico.jpg` | Bloque 4 — efecto fuga. Pieza distintiva. |
| 04 | `graficos/04-mapa-cruceros-canarias.jpg` | Bloque 2 o 4 — presión por isla. |
| 05 | `graficos/05-comparativa-internacional.jpg` | Bloque 5 — qué han hecho otras ciudades. |

Paleta: azul Canarias `#1750C5`, amarillo Canarias `#FFCB05`, gris neutro para la fuga. Coherente con la identidad foresight (logotipo ojo en `faros-branding/ojo-foresight/`).

## Cómo regenerar

```bash
# Gráficos
python3 ~/Library/Application\ Support/Claude/.../outputs/generate_charts.py
# Si se quieren retocar etiquetas o colores, editar el script y volver a ejecutar.

# Word
node ~/Library/Application\ Support/Claude/.../outputs/build_docx.js
# Genera informe.docx en esta misma carpeta.
```

Los scripts viven en la carpeta temporal de outputs. Si los necesitas permanentemente, conviene copiarlos a `KOINOS/scripts/informes/`.

## Próximos pasos

- [ ] Revisar el docx en LibreOffice/Word antes de grabar, sobre todo el flujo de los gráficos del anexo.
- [ ] Si decides convertir el sankey en una animación, exportar el script con frames intermedios.
- [ ] Pendiente integrar capa de **vivienda vacacional** y **presión turística por sección censal** en POLIS para reforzar el gráfico 4 con datos espaciales más finos.
- [ ] Decidir si publicas la versión PDF en koinos.es como adjunto del vídeo.

## Catálogo de membretes

Los membretes (chyrons) reutilizables para citación on-screen están centralizados en `docs/MEMBRETES.md` en la raíz de docs. Cada dato del guion lleva su ID de membrete asignado.
