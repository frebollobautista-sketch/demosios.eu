# Política de curación — POLIS iso

> Documento de gobernanza editorial. Define qué entra, qué NO entra, y
> por qué. Esta política rige toda capa de contenido cultural,
> comercial y social del visor. **No es una decisión técnica; es una
> decisión política**.

## Principio rector

El espacio que dibuja POLIS es el **tejido social local**. El mapa no
es neutro: hace visible lo que sostiene la vida en el territorio e
**invisibiliza activamente lo que la extrae**.

Lo que se invisibiliza no se renderiza. Punto. No aparece en los
pins, no aparece en el buscador, no aparece en los popups.

## ✅ Incluido

Entran las entidades que **contribuyen al tejido social local**:

- **PYMEs locales** (≤ 50 trabajadores, propiedad local) — talleres,
  bodegas, queserías, panaderías de barrio, herreros, ebanistas.
- **Cooperativas** — agrarias, de consumo, de trabajo asociado, de
  vivienda en propiedad colectiva.
- **Asociaciones vecinales** — registradas o de hecho, federadas o
  independientes.
- **Asociaciones culturales y deportivas** sin ánimo de lucro,
  arraigadas en el barrio.
- **Espacios comunitarios autogestionados** — centros sociales,
  bibliotecas populares, casas de la cultura.
- **Mercadillos** y mercados de productores.
- **Huertos urbanos** y agricultura ecológica de pequeña escala.
- **Eventos culturales** de instituciones públicas o de iniciativas
  ciudadanas.
- **Patrimonio común** — sitios BIC, monumentos, espacios naturales.

## ❌ Excluido (invisibilizado)

NO entran en el mapa:

- **Franquicias y cadenas** — McDonald's, Starbucks, Mercadona, Lidl,
  Carrefour, Inditex, El Corte Inglés, Burger King, KFC, Subway, etc.
  Incluso si su local físico está en el barrio: lo que se ve en el
  mapa es la PYME que sostiene a la vecindad, no el extractor.
- **Empresas multinacionales** o grupos con sede fuera de Canarias
  que operan localmente como sucursal.
- **Grandes superficies comerciales** (centros comerciales,
  hipermercados).
- **Entidades con prácticas controvertidas documentadas** — greenwashing
  comprobado, vulneraciones laborales sistemáticas, complicidad con
  desalojos o gentrificación, lavado de imagen. Aquí la línea no es
  de tamaño sino de práctica: una PYME que precariza tampoco entra.
- **Plataformas de la economía extractiva** — apartamentos turísticos
  vacacionales (Airbnb, Booking, etc. — ojo: el overlay `vv` los
  muestra como problema, NO como recurso. La distinción está en el
  framing del popup y la categoría).
- **Marcas blancas o productos importados** vendidos sin trazabilidad
  local.

## Criterios de decisión

Para cada entrada candidata, plantear estas preguntas (en este orden):

1. **¿Quién es el propietario?** Si es franquicia, multinacional o
   capital externo: NO.
2. **¿Cuánto factura / cuánta gente emplea?** Si supera el umbral de
   PYME (50 trabajadores, balance > 10M€, facturación > 50M€ según
   definición UE): evaluar con cuidado. La intención es proteger el
   pequeño y mediano comercio local, no el "mediano" que ya tiene
   músculo extractor.
3. **¿Distribuye beneficios localmente?** Si los beneficios salen
   del territorio o de la mano de obra: NO.
4. **¿Tiene prácticas controvertidas documentadas?** Vulneraciones
   laborales, ambientales, especulación inmobiliaria, lavado:
   NO entra, aunque sea PYME.
5. **¿Contribuye al tejido?** Mercadillo, fiesta del barrio, lavadero
   colectivo, banco del tiempo, escuela infantil: SÍ entra, incluso
   si no genera ingresos.

## Cómo reflejar la política en el código

La política se materializa en:

- **`docs/CULTURAL-CONTENT-FORMAT.md`** — el campo `tejido_social`
  puede usarse como marcador booleano (por defecto `true` para todo
  contenido nuevo). Una entrada con `tejido_social: false` no se
  renderiza.
- **Sin entrada en el geojson = no aparece**. La invisibilización
  por omisión es la primera línea: no curamos lo que excluimos.
- **Priorización en buscador** (`search.js · typeBonus`): productores
  y tejido social arriba; muns/eventos en el medio; venues
  derivados al final. Refuerza visualmente la jerarquía.

## Casos límite que mantenemos en debate

- **Eventos en venues semi-públicos** (auditorios, teatros municipales):
  entran como eventos porque el contenido cultural es lo que se valora,
  no la institución.
- **Banco / cajas de ahorros locales** vs grandes bancos: el banco
  local con arraigo (Cajacanarias en su época) entraría; un BBVA o
  Santander, no.
- **Productos de PYME con distribución por multinacional**: si la
  PYME es la productora y mantiene control, entra. Si solo la
  multinacional pone su marca, no.

## Revisión

Esta política se revisa con cada nueva fuente de datos. Si una
contribución comunitaria reta una decisión, se discute en abierto
antes de aceptarla.

— Pancho, mayo 2026
