# Catálogo de gestos cívicos · borrador

> Diseño del árbol de gestos expandido y la tabla declarativa
> gesto × sujeto. Documento de **referencia y contrato negociable**,
> previo a la implementación en `public/polis-app/gestos.js`.
>
> Última actualización: 2026-05-13. Estado: **borrador para discusión**.
> Las decisiones marcadas `PENDIENTE` requieren acuerdo antes de codear.

## Propósito

Hoy `gestos.js` define 4 tipos (`senal`, `reporte`, `compromiso`,
`registro_entidad`) y una taxonomía corta de reportes por ámbito. Esto
quedó pequeño en cuanto se mira en serio la interacción con comercios,
asociaciones, espacios y eventos.

Este doc propone:

1. Una taxonomía de **sujetos** (sobre qué cae el gesto).
2. Un **catálogo de gestos** organizado por capas de compromiso.
3. Una **matriz declarativa** de aplicabilidad gesto × sujeto.
4. Un **shape** para el módulo, derivable a índices en runtime.
5. Las **consecuencias para el iso** (popup unificado, hit-test
   genérico, condiciones de visibilidad).

El backend Supabase (chat Next.js) consumirá el mismo catálogo. Mantener
los IDs estables desde el día uno.

## 1 · Taxonomía de sujetos

Nueve tipos. Derivan de las capas de datos ya cargadas en el iso.

| ID | Origen actual | Hit-target | Notas |
|---|---|---|---|
| `comercio` | `productores.geojson`, mercadillos | punto, ancla a edificio si coincide | Incluye productores artesanos curados. Franquicias filtradas por `CURATION-POLICY.md`. |
| `entidad_civica` | `tejido-social.geojson` | punto/polígono | Cooperativas, asociaciones, centros sociales, huertos urbanos, bibliotecas populares. |
| `espacio_publico` | `parks.json`, plazas | polígono | 6 buckets ya en `overlays/parques.js`. |
| `equipamiento` | centros educativos, hospitales | punto | Lo provee el estado. No se "registra" — sólo se observa. |
| `evento` | `eventos.geojson` | efímero, sin geom fija | Caduca por fecha. |
| `patrimonio` | BIC (cuando se desbloquee WMS) | punto/polígono | Hoy ❌ — pendiente endpoint WFS. |
| `vivienda` | residencial común | polígono | Privacidad. Admite **sólo** `arraigo_aqui` (anónimo, agregado por barrio, nunca por edificio) y `reporte` impersonal de zona. Las viviendas vacacionales (`vv-prov35.geojson`) **no** son `vivienda` aquí — se resuelven como `comercio` desde el hit-test (porque lo son, contra la curación de turismo masivo). |
| `infra_movilidad` | paradas + líneas guagua | punto/línea | Reportes específicos de transporte. |
| `edificio_generico` | building OSM sin tipo | polígono | Lo que no encaja en lo demás. Sólo admite gestos genéricos. |

## 2 · Catálogo de gestos por capa

Capas ordenadas por **coste para el usuario** (esfuerzo y exposición).
Capa baja → mucho volumen, poca señal. Capa alta → poco volumen, mucho
valor por gesto.

### Capa 0 · Pasiva

- **`visita`** — se registra al abrir el popup del sujeto. Sin click.
  Permite detectar lugares con atención pero sin gestos activos.
  Anónimo, sin payload.

### Capa 1 · Atómica · 1 click anónimo

- **`senal_pos`** / **`senal_neg`** — pulgar arriba/abajo. Ya existe.
- **`sigue_vivo`** — confirma que el comercio o entidad sigue activo.
  Mantenimiento del mapa contra obsolescencia. Aplicable a sujetos con
  riesgo de desaparecer (comercio, entidad_civica).
- **`guardar`** — bookmark personal, no se publica. Se almacena en
  perfil del usuario (necesita backend) o localStorage.
- **`arraigo_aqui`** — "mi familia vive aquí desde hace generaciones".
  Sólo aplica a `vivienda` residencial. Anónimo, 1-click, sin payload
  identificador. **Agregación obligatoria por barrio, nunca por
  edificio** — anti-dox. El conteo se publica como métrica de barrio
  ("78% arraigo declarado en Vegueta"), nunca como pin en el mapa.

### Capa 2 · Marcador · 2-3 click anónimo

- **`check_in`** — "estuve aquí esta semana". Suma anónima, payload
  vacío excepto timestamp.
- **`recomiendo_para`** — etiqueta de un menú cerrado:
  `con_crios | tarde | barato | lluvia | solo | grupo | pareja | trabajo`.
- **`reporte`** — gesto existente. Ampliar taxonomía con categorías por
  tipo de sujeto (ver §5).
- **`rango_precio`** — `accesible | medio | caro`. Sólo comercios y
  eventos con precio.
- **`accesibilidad`** — multi-checkbox observacional: `rampa | bano |
  parking | mascotas | wifi | sombra | iluminacion_nocturna`.

### Capa 3 · Aportación · identidad opcional, asíncrona

- **`foto`** — imagen del lugar. Cola de moderación obligatoria.
- **`anecdota`** — texto corto (≤280 char) asociado al lugar.
  "Aquí abrí mi primera cuenta en 1992."
- **`memoria_historica`** — testimonio de algo que ya no está.
  "Aquí estaba la antigua bodega de Don Pepe hasta 2018."
- **`propuesta`** — texto libre de cambio cívico. Sustituye al hueco
  actual del reporte (que es categoría preset).
- **`alta_ciudadana`** — "este sitio existe y no está en el mapa".
  Crea un sujeto nuevo en cola de moderación.
- **`baja`** — "este sitio cerró". Marca para revisión.

### Capa 4 · Compromiso · identidad voluntaria

- **`cliente_habitual`** — declaración pública de afecto a un comercio
  local. Red visible.
- **`me_ofrezco`** — voluntariado/mentoría/intercambio en una entidad
  cívica o evento.
- **`contribuyo`** — mecenazgo declarado. Sin pasarela de pago — sólo
  señal pública de respaldo material.
- **`convoco_aqui`** — uso del espacio para un evento. Genera un
  `evento` nuevo en cola de moderación.

### Capa 5 · Vinculación oficial · identidad verificada

- **`soy_de_entidad`** — auto-alta como representante de una entidad.
  Requiere validador externo (URL/NIF/registro). Ya existe como
  `registro_entidad` en el código actual.
- **`alianza`** — arista entre dos entidades verificadas.
- **`publico_balance`** — transparencia voluntaria. URL a documento.
- **`respaldo`** — una entidad respalda públicamente otra entidad o
  evento.

## 3 · Matriz de aplicabilidad

`✓` aplica · `–` no aplica · `▲` aplica con condición (ver §4)

| Gesto | comercio | entCív | esPúb | equip | evento | patrim | mov | genér |
|---|---|---|---|---|---|---|---|---|
| visita | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| senal_pos / senal_neg | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| sigue_vivo | ✓ | ✓ | – | – | – | – | – | – |
| guardar | ✓ | ✓ | ✓ | – | ✓ | ✓ | – | – |
| check_in | ✓ | ✓ | ✓ | – | ✓ | – | – | – |
| recomiendo_para | ✓ | ✓ | ✓ | – | ✓ | – | – | – |
| reporte | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| rango_precio | ✓ | – | – | – | ▲ | – | – | – |
| accesibilidad | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| foto | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| anecdota | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | ✓ |
| memoria_historica | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | ✓ |
| propuesta | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ |
| alta_ciudadana | ▲ | ▲ | – | – | ✓ | – | – | – |
| baja | ✓ | ✓ | – | – | – | – | – | – |
| cliente_habitual | ✓ | – | – | – | – | – | – | – |
| me_ofrezco | – | ✓ | ✓ | – | ✓ | – | – | – |
| contribuyo | – | ✓ | – | – | ✓ | – | – | – |
| convoco_aqui | – | ✓ | ✓ | – | – | – | – | – |
| soy_de_entidad | ▲ | ▲ | – | – | – | – | – | – |
| alianza | ▲ | ▲ | – | – | – | – | – | – |
| publico_balance | ▲ | ▲ | – | – | – | – | – | – |
| respaldo | ▲ | ▲ | – | – | ✓ | – | – | – |

> **Nota sobre `vivienda` residencial**: omitida de la matriz por
> claridad. Admite únicamente `arraigo_aqui` (anónimo, agregado por
> barrio) y `reporte` impersonal. Las viviendas vacacionales se
> resuelven como `comercio` desde el hit-test.

## 4 · Condiciones (los `▲`)

- **`rango_precio` en evento** → sólo si `evento.tiene_precio === true`.
- **`alta_ciudadana`** en comercio/entidad_civica → sólo si el sujeto
  **no** existe ya en dataset (el gesto crea el sujeto). Cola de
  moderación obligatoria.
- **`soy_de_entidad`** → requiere identidad pseudónima estable +
  validador externo (`url`/`nif`/`registro_*`).
- **`alianza`** → ambas entidades deben tener `soy_de_entidad`
  verificado.
- **`publico_balance`** → sólo desde rol `representante_entidad`
  verificado.
- **`respaldo` sobre entidad** → sólo desde rol `representante_entidad`
  verificado del respaldador.
- **Capa 4-5 sobre comercio** → la curación filtra franquicias. Si
  `comercio.franquicia === true`, el gesto se registra pero no se
  publica. Ver `CURATION-POLICY.md`.
- **`arraigo_aqui` sobre vivienda** → agregación obligatoria por
  barrio. El evaluador debe descartar la `zona` puntual (cusec/edificio)
  antes de persistir y conservar sólo el `barrio_id`. Sin esto, el
  gesto es un vector de doxing.
- **Hit-test sobre `vv-prov35`** → devuelve `sujeto.tipo === "comercio"`
  con `flags.es_vv = true`, no `vivienda`. La curación de turismo
  masivo decide qué se publica.
- **Gestos sobre `equipamiento`** → agregación obligatoria a nivel
  municipio para publicación. El gesto se registra sobre el
  equipamiento concreto (colegio X, hospital Y) pero las métricas
  públicas se muestran sólo agregadas por municipio. Misma lógica
  anti-dox/anti-linchamiento que `arraigo_aqui`. Aplica a todos los
  gestos sobre equipamiento, no a unos sí y otros no, para no abrir
  una vía indirecta de exposición.

## 5 · Taxonomía de `reporte` por sujeto

La taxonomía actual indexa por **ámbito** (`espacio`, `movilidad`,
`alimentacion`, `cultura`). Cuando el gesto se ancla a un sujeto
concreto, se necesita refinar:

```
reporte sobre comercio:
  cerrado, precio_abusivo, trato_pobre, info_desactualizada,
  no_corresponde_al_mapa

reporte sobre entidad_civica:
  inactiva, no_responde, info_desactualizada, conflicto

reporte sobre espacio_publico, equipamiento, infra_movilidad:
  (mantener taxonomía actual por ámbito)

reporte sobre evento:
  cancelado, mal_informado, accesibilidad, precio_oculto

reporte sobre patrimonio:
  deterioro, vandalismo, accesibilidad, info_incorrecta

reporte sobre vivienda, edificio_generico:
  (siempre impersonal: insalubridad, abandono, ruina)
```

## 6 · Shape declarativo propuesto

Una sola fuente, índices derivados en carga.

```js
export const GESTO_CATALOG = {
  visita: {
    capa: 0,
    coste: "auto",
    identidad: "anonimo",
    ui: "implicito",
    aplica_a: ["comercio","entidad_civica","espacio_publico",
               "equipamiento","evento","patrimonio",
               "infra_movilidad"],
    condiciones: []
  },

  recomiendo_para: {
    capa: 2,
    coste: "2-click",
    identidad: "anonimo",
    ui: "tag-picker",
    payload_schema: {
      tag: ["con_crios","tarde","barato","lluvia",
            "solo","grupo","pareja","trabajo"]
    },
    aplica_a: ["comercio","entidad_civica","espacio_publico","evento"],
    condiciones: []
  },

  soy_de_entidad: {
    capa: 5,
    coste: "form",
    identidad: "pseudonimo_verificado",
    ui: "form-validador",
    payload_schema: {
      categoria: "ref:CATEGORIAS_ENTIDAD",
      validador_tipo: "enum:url|nif|registro_asociaciones|registro_cooperativas|do_quesos",
      validador_valor: "string"
    },
    aplica_a: ["comercio","entidad_civica"],
    condiciones: [
      { tipo: "requiere_validador",
        validadores: ["url","nif","registro_asociaciones","registro_cooperativas"] },
      { tipo: "moderacion", flag: "pendiente_admin" }
    ]
  },

  // ... resto
};
```

Índices derivados en runtime:

```js
export const GESTOS_POR_SUJETO = deriveBySubject(GESTO_CATALOG);
// → { comercio: ["visita","senal_pos",...], entidad_civica: [...] }

export function gestosDisponiblesPara(sujeto, contexto) {
  // sujeto  = { tipo, id, flags: {franquicia, tiene_precio, ...} }
  // contexto = { actor: {identidad, rol}, zona, datos: {...} }
  return (GESTOS_POR_SUJETO[sujeto.tipo] || [])
    .map(id => ({ id, ...GESTO_CATALOG[id] }))
    .filter(g => evaluarCondiciones(g, sujeto, contexto));
}
```

Tipos de `condicion` que el evaluador debe entender:

- `requiere_identidad: pseudonimo_estable | pseudonimo_verificado`
- `requiere_validador: [validador_id, ...]`
- `requiere_rol: representante_entidad`
- `requiere_flag_sujeto: { campo, valor }`
- `requiere_flag_sujeto_negado: { campo, valor }` (para
  `alta_ciudadana`: el sujeto no existe ya)
- `moderacion: pendiente_admin | pendiente_validador_externo`
- `oculto_si_flag: { campo, valor }` (para franquicia: registra pero no
  publica)

## 7 · Consecuencias para el iso

Implementar este catálogo en `gestos.js` no requiere tocar nada del iso
inmediatamente. Pero cuando se enchufe a UI, fuerza tres cambios:

1. **Popup recibe un `sujeto` tipado.** Hoy hay popups separados
   (`openProductorPopup`, `openTejidoPopup`, `openEventoPopup`…).
   Pasan a recibir `sujeto = {tipo, id, flags}` y los gestos se
   calculan vía `gestosDisponiblesPara`.
2. **Render de botones genérico.** Cada gesto declara su `ui`
   (`icon-button`, `tag-picker`, `form-validador`, `text-input`,
   `implicito`). El popup itera el catálogo y dibuja, no hardcodea.
3. **Hit-test unificado `pickEntity(x,y)`.** Hoy cada overlay tiene su
   tap propio. Hace falta un picker que devuelva un sujeto tipado
   independientemente de qué capa lo dibujó. Ya hay precedente en el
   tap-target pendiente de barrio (`HANDOFF-NAVEGACION.md`).

## 8 · Decisiones pendientes

- **DECIDIDO 2026-05-13** Capa 3 (foto, anécdota, memoria, propuesta):
  ruta mixta. Anónimo permitido pero el contenido anónimo queda en
  cola de moderación antes de publicar; el contenido firmado con
  pseudónimo estable se publica directo. Mantiene "anonimato por
  defecto" como filosofía y empuja suavemente hacia pseudónimo sin
  obligarlo. Coste: dos rutas de publicación en el evaluador.
- **DECIDIDO 2026-05-13** Vivienda dividida en dos comportamientos:
  (a) residencial común admite **sólo** `arraigo_aqui` (capa 1, anónimo,
  agregado obligatorio por barrio — nunca por edificio) y `reporte`
  impersonal; (b) viviendas vacacionales se resuelven como `comercio`
  desde el hit-test, con la matriz completa de comercio aplicada
  (incluido `baja`, `senal_neg`, `reporte`).
- **DECIDIDO 2026-05-13** `edificio_generico` no admite `visita`.
  Coherente con que `visita` mide atención sobre algo identificable.
  El polígono genérico no lo es. Se conservan `anecdota`,
  `memoria_historica` y `propuesta` como gestos de memoria del lugar,
  más `reporte` impersonal.
- **DECIDIDO 2026-05-13** Texto libre y foto se abren ya, **sin
  publicación pública**. Cada gesto se registra en localStorage del
  usuario y sólo es visible para él mismo ("mis anécdotas / mis
  propuestas / mis fotos"). Cuando llegue Supabase, se suben con sello
  de fecha original y entran en cola pública de moderación. Ventaja:
  el árbol funciona desde el día uno y se acumula contenido auténtico
  con datación real, sin riesgo de moderación porque nada se publica.
  Aplica a: `anecdota`, `memoria_historica`, `propuesta`, `foto`,
  `alta_ciudadana`.
- **DECIDIDO 2026-05-13** Gestos sobre `equipamiento` (educativo y
  sanitario) se mantienen en la matriz completa, pero con **agregación
  obligatoria por municipio** para publicación. Captura el valor de
  expresión sobre servicios públicos sin exponer al equipamiento
  individual a campañas dirigidas. Misma lógica anti-dox que
  `arraigo_aqui` por barrio. El registro interno conserva la unidad
  concreta para auditoría de admin; la UI pública sólo agrega.
- **DECIDIDO 2026-05-13** Iconografía pospuesta. Texto plano en los
  botones hasta que la UI de popups esté lo bastante avanzada para
  saber distribución, jerarquía visual y prominencia de cada gesto.
  Encargar 24 glifos antes de eso es trabajo que se rehace. Cuando
  llegue, se diseñan contra la estética Into the Breach (paper
  `#F5E8C8`, ink `#1A1612`, sombras planas 4-8px, sin gradientes).

## 9 · Implementación — próximos pasos cuando se acuerde

1. Acordar la matriz §3 y resolver los `PENDIENTE` de §8.
2. Extender `gestos.js` con `GESTO_CATALOG`, `GESTOS_POR_SUJETO` y
   `gestosDisponiblesPara`. No tocar UI.
3. Tests unitarios del evaluador de condiciones.
4. Refactor de popups para recibir `sujeto` tipado y consumir el
   catálogo.
5. Implementar `pickEntity(x,y)` unificado.
6. Iconografía + UI de cada `ui`-type.

— Pancho · 2026-05-13
