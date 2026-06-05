# GESTOS VENTANILLA · v1

Fecha: 2026-05-28
Estado: árbol canónico aprobado · pendiente implementación UI.

POLIS pivota de "explorador territorial" a **ventanilla única ciudadana**.
Cada gesto es un verbo en primera persona = una acción que el ciudadano
inicia. Cada chip dentro del gesto es una pieza de **tres dimensiones**:

```
VER (mapa) · CONSULTAR (ficha) · HACER (trámite)
```

## Los 11 gestos

| # | Gesto | Lo que vengo a hacer aquí |
|---|---|---|
| 1 | Empadronarme | Padrón, IBI, agua, basura, vivienda, bonificaciones |
| 2 | Cuidarme | Cita SCS, farmacia de guardia, dependencia, salud mental |
| 3 | Estudiar | Zona escolar, plazas, beca, comedor, formación, telecentros |
| 4 | Comer | Mercados, productores, huertos, ayudas alimentarias |
| 5 | Trabajar | Paro, ayudas al empleo, formación profesional, autoempleo |
| 6 | Moverme | Bonos transporte, líneas, paradas, bici, recarga |
| 7 | Convivir | Asociaciones, centros cívicos, recursos vecinales |
| 8 | Disfrutar | Eventos, bibliotecas, polideportivos, playas, parques |
| 9 | Participar | Consultas abiertas, subvenciones a entidades, contratos, voto |
| 10 | Recordar | Patrimonio, memoria democrática, yacimientos, identidad |
| 11 | Avisar | Reportar incidencia, alertas activas, riesgos en mi zona |

## Mapeo indicador → gesto

Estado: ✓ overlay existe · ◑ data lista, falta overlay · ○ pendiente entero.

### 1 · Empadronarme
- Viviendas vacías y 2ª residencia (vv) ✓
- Renta media (renta) ✓
- Padrón ○
- IBI / agua / basura ○
- Bonificaciones de servicios ○

### 2 · Cuidarme
- Centros de salud (centros-salud) ✓
- Lista de espera (lista-espera) ✓
- Farmacias y guardias (farmacias) ◑
- Dependencia ○
- Salud mental ○

### 3 · Estudiar
- Centros educativos (educacion) ✓
- Comedores escolares y becas (comedores-escolares) ✓
- Telecentros y Aulas Mentor (telecentros) ○
- Bibliotecas — mover de Disfrutar si encaja mejor aquí

### 4 · Comer
- Productores locales (productores) ✓
- Comercio de alimentación (alimentacion) ✓
- Huertos urbanos comunitarios ○
- Ayudas alimentarias / banco alimentos ○

### 5 · Trabajar
- Paro registrado (paro) ✓
- Formación profesional ○
- Autoempleo / economía social ○

### 6 · Moverme
- Guaguas (guaguas) ✓
- Cobertura bus (cobertura) ✓
- Titsa (titsa) ✓
- Movilidad suave / carriles bici (movilidad-suave) ✓
- Bici y recarga (bici-recarga) ✓

### 7 · Convivir
- Tejido social / asociaciones (tejido-social) ✓
- Ágora · espacios públicos (agora) ✓
- Centros cívicos municipales (centros-civicos) ◑

### 8 · Disfrutar
- Eventos (eventos) ✓
- Sedes culturales (cultura-venues) ✓
- Registro cultural oficial (registro) ✓
- Parques y zonas verdes (parques) ✓
- Playas (playas) ✓
- Mobiliario urbano (mobiliario) ✓
- Árboles singulares (arboles-singulares) ✓
- Espacios naturales protegidos (enp) ✓

### 9 · Participar
- Subvenciones GobCan (subvenciones) ✓  *(movido desde Trabajar)*
- Resultados electorales por sección (elecciones) ◑
- Contratos públicos PLACSP ○
- Consultas y procesos participativos ○

### 10 · Recordar
- Patrimonio protegido / BIC (bic) ✓
- Memoria democrática (memoria-democratica) ✓
- Yacimientos prehispánicos (yacimientos) ✓
- Barrios (identitario) (barrios) ✓

### 11 · Avisar
- Calidad del aire (calidad-aire) ✓
- Calima (calima) ✓
- Zonas inundables (inundacion) ✓
- Peligro volcánico (peligro-volcanico) ✓
- Incendio forestal ○
- Riesgo sísmico ○
- Oleaje peligroso ○
- Reportar incidencia (formulario ciudadano) ○

> Nota Avisar: los indicadores funcionan como **estado dinámico**. Si una
> alerta está activa (PEVOLCA fase ≥ 1, AEMET aviso naranja+, etc.) el
> chip aparece destacado y empuja banner superior fuera del gesto. En el
> 95% de los días Avisar es el sitio donde el ciudadano *reporta*, no
> donde consulta.

## Esquema de acciones (contrato)

Cada indicador necesita, además de su geojson, una entrada en el catálogo:

```js
{
  id: "centros-salud",          // id técnico del overlay
  gesto: "cuidarme",
  chip: {
    label: "Centros de salud",  // 1-3 palabras
    icono: "ocre:salud-cruz",   // ref al iconset OCRE
    metrica_viva: {
      // qué se muestra debajo de la etiqueta cuando el chip está cerrado
      // ej. "12 días espera" calculado desde el feature más cercano al usuario
      fuente: "lista-espera",
      formato: "${dias} días esp.",
    }
  },
  ficha: {
    titulo: "Atención primaria SCS",
    descripcion: "Red pública de centros de salud y consultorios locales del Servicio Canario de Salud.",
    que_mide: "Ubicación + especialidades + horarios + lista de espera asociada",
    fuente: {
      nombre: "SCS · Servicio Canario de Salud",
      url: "https://www3.gobiernodecanarias.org/sanidad/scs/",
      actualizado: "2026-05-15"
    }
  },
  acciones: [
    {
      tipo: "enlace",
      label: "Pedir cita SCS",
      url: "https://www3.gobiernodecanarias.org/sanidad/scs/cita_previa.html"
    },
    {
      tipo: "telefono",
      label: "Llamar al centro",
      valor_dinamico: "properties.telefono"   // del feature seleccionado
    },
    {
      tipo: "filtro",
      label: "Urgencias 24h cercanas",
      capa_secundaria: { id: "centros-salud", filter: { tipo: "urgencias" } }
    },
    {
      tipo: "formulario_externo",
      label: "Reclamar tiempo de espera",
      url: "https://sede.gobcan.es/sscc/queja"
    }
  ]
}
```

### Tipos de acción soportados (v1)

| tipo | descripción | params |
|---|---|---|
| `enlace` | Abre URL externa | `url` |
| `telefono` | Lanza `tel:` | `valor` o `valor_dinamico` |
| `email` | Lanza `mailto:` | `valor` |
| `filtro` | Aplica filtro/capa secundaria sobre el propio overlay | `capa_secundaria` |
| `formulario_externo` | Abre sede electrónica o formulario | `url` |
| `formulario_interno` | Abre form en la app (reportar incidencia, etc.) | `form_id` |
| `mapa_secundario` | Pinta una capa de apoyo (rutas, isócronas) | `overlay_id` |
| `descargar` | Descarga PDF/CSV (resolución BOC, plano oficial…) | `url` |

## Pieza chip — estados

**Cerrado (en la grid del gesto):**
```
┌──────────────┐
│      ⊕       │  ← icono OCRE (40×40)
│   CENTROS    │  ← label (1-3 palabras)
│   DE SALUD   │
│ ─────────────│
│ 12 días esp. │  ← métrica viva
└──────────────┘
```

**Estados:** `inactivo` (contorno) · `activo` (relleno sólido) · `pendiente` (gris atenuado, sin tap) · `alerta` (borde rojo pulsante, solo Avisar).

**Abierto (overlay modal sobre el mapa):**
1. Cabecera: ← Gesto · Chip · [×]
2. Mapa con la capa activa + tu ubicación (si disponible)
3. Resumen contextual ("Tu centro: CS Vecindario, 0,8 km")
4. Lista de **acciones** (botones grandes, sin nesting)
5. Pie: fuente + fecha actualización

## Próximos pasos técnicos

1. **`public/polis-app/acciones-catalogo.js`** — catálogo JS canónico, lo
   importa el cog-modal y el componente chip-ventanilla.
2. **Componente chip-ventanilla** en `public/polis-app/chip-ventanilla.js`
   (cerrado + abierto + modal). Estilos en `style.css`.
3. **Refactor `AMBITOS` en `app.js`** para sustituirlos por `GESTOS`
   (11 entradas con verbos en primera persona).
4. **Pasarela métrica viva** — función que, dado el `seccion_actual`,
   resuelve la métrica del chip cerrado contra el geojson cargado.
5. **Mapeo iconos OCRE v1 → chips** — guagua para Moverme/guaguas,
   drago para Disfrutar/árboles, casa terrera para Empadronarme,
   espiga millo para Comer, timple para Disfrutar/eventos, hoja drago
   para Recordar/yacimientos, calado para Convivir, nudo cestería para
   Convivir/asociaciones. Restantes (10) sin icono OCRE, ver `docs/`.
