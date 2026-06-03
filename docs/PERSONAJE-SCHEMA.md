# PERSONAJE — esquema compartido (AGORA mausoleo ↔ BIBLIOTHEKA teóricos)

Contrato común para figuras históricas representadas como cuentas. Lo
consumen **dos superficies**:

- **AGORA / Mausoleo de Twitter** — figuras canarias + universales como
  cuentas de red social (`agora-app/feed.js → _loadMausoleo`).
- **BIBLIOTHEKA / teóricos** — autores del corpus teórico. Un teórico puede
  ser fuente en BIBLIOTHEKA *y* cuenta en el mausoleo de AGORA: el mismo
  registro alimenta ambas. Acordar el esquema antes de duplicar.

> **Curaduría — el arte es dimensión OBLIGATORIA del mausoleo.** No es solo
> política y teoría: pintura, literatura, música y arquitectura tienen que
> estar (especialmente arte canario: Néstor, César Manrique, Pino Ojeda,
> Manolo Millares, Saulo Torón…). Para la obra plástica/visual es clave
> `modo:"imagen"` (IG-style) además de la cita; `ocupacion`/`obras`/`corriente`
> ya soportan estas figuras sin cambios de esquema.

El runtime **solo renderiza**. Todo el sourcing (datos + glosa) se hace
**offline / build-time** (`scripts/sourcing/`) y se guarda ya etiquetado.

---

## Forma del registro

```jsonc
{
  "_meta": {
    "generado": "2026-06-02",                 // ISO date del build
    "fuente_datos": "Wikidata (CC0) + Wikiquote (CC-BY-SA) + Commons (per-file)",
    "nota_glosa": "modo:glosa = redacción IA contextual (ai-gloss), no cita literal.",
    "total": 4
  },
  "personajes": [ Personaje, ... ]
}
```

### Personaje

| Campo | Tipo | Fuente | Notas |
|---|---|---|---|
| `id` | string (slug) | propio | kebab-case estable; clave de `@handle` |
| `nombre` | string | Wikidata label (es) | |
| `nacimiento` | string\|null | Wikidata P569 | año |
| `muerte` | string\|null | Wikidata P570 | año; mausoleo ⇒ figuras fallecidas |
| `ambito` | `"canario"`\|`"universal"` | regla: P19 sube a Q5813 ⇒ canario | |
| `corriente` | string | P135 / curaduría | corriente / escuela |
| `ocupacion` | string[] | Wikidata P106 | |
| `obras` | string[] | Wikidata P800 | máx ~6 |
| `retrato_url` | string\|null | P18 → Commons `Special:FilePath` | |
| `retrato_licencia` | string\|null | Commons `extmetadata.LicenseShortName` | per-file |
| `retrato_autor` | string\|null | Commons `extmetadata.Artist` | atribución |
| `fuente` | `{wikidata, wikiquote}` | URLs | crédito CC-BY-SA |
| `posts` | Post[] | mixto | timeline híbrido |

### Post (timeline)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | único dentro de la figura |
| `modo` | `"cita"`\|`"glosa"`\|`"imagen"` | Twitter-style (cita) · IG-style (imagen) |
| `texto` | string | cuerpo |
| `media` | string (url)? | solo `modo:"imagen"` |
| `fuente` | string\|null | ref de la cita (obra, año) |
| `verificacion` | enum **obligatorio** | ver abajo |

---

## `verificacion` — etiquetado ESTRUCTURAL (no cosmético)

Es el campo que evita poner palabras inventadas en boca de los muertos.
Decide cómo se renderiza; nunca se omite:

- **`real-sourced`** — cita verbatim con referencia (Wikiquote `{{Fuente}}` /
  obra+año). UI: badge "❝ Cita" + línea de fuente + enlace al origen.
- **`real-unsourced`** — cita atribuida sin fuente verificable. UI: badge
  "❝ Cita" + aviso "sin fuente verificada".
- **`ai-gloss`** — contextualización redactada por IA sobre datos públicos.
  UI: badge persistente "✶ Glosa IA" + nota "Redacción IA". Tipografía
  distinta de la cita (no cursiva entrecomillada). **La IA nunca emite citas
  en primera persona** ni produce `real-sourced`: ese campo es solo-datos.

Reglas de oro: solo figuras históricas / dominio público; la glosa
contextualiza, no fabrica; mantener crédito CC-BY-SA de Wikiquote/Commons.

---

## Pipeline de sourcing

`scripts/sourcing/mausoleo-sourcing.mjs` → `public/data/agora/personajes.json`.
Por figura: SPARQL Wikidata (1 llamada) → retrato Commons (+licencia) →
citas Wikiquote (parse wikitext, `*`-líneas, captura `{{Fuente}}`) → glosa
curada. Playbook completo de fuentes: ver el agente de sourcing y
`docs/SOCIAL-ROADMAP.md`.

## Estado

- AGORA Fase 1–2 (2026-06-02): 4 figuras semilla validadas (Galdós, Viera y
  Clavijo, Curie, MLK). 21 posts (13 citas + 8 glosas) renderizando en el
  feed con badge estructural. Falta escalar a ~12–17 figuras e introducir
  `modo:"imagen"` (Néstor → IG-style).
- BIBLIOTHEKA: dueño de los teóricos; consume este esquema. Coordinar qué
  figuras son compartidas para no duplicar sourcing.
