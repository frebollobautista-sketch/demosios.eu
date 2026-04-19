# Capital cívico en OCRE

Tres ejes griegos, no mezclables con capital económico.

## Los tres ejes

| Eje | Griego | Castellano | En una frase |
|---|---|---|---|
| `koinonia` | Κοινωνία | Capital social | Vínculos, cuidado, asociacionismo, convivencia. |
| `paideia` | Παιδεία | Capital cultural | Formación, obra, memoria del común. |
| `politeia` | Πολιτεία | Capital político | Gobernanza, deliberación, recuperación de espacios. |

Implementación: [`src/lib/capital/ejes.ts`](../src/lib/capital/ejes.ts).

## Cómo alimenta cada sección PHAROS a cada eje

Cada una de las 8 secciones temáticas heredadas de PHAROS tiene un **eje principal** (peso 1.0) y uno o varios **secundarios** (peso 0.4):

| Sección PHAROS | Koinonía | Paideía | Politeía |
|---|---|---|---|
| Salud, servicios sociales y economía reproductiva | **1.0** | — | — |
| Cambio climático y autonomía estratégica | — | 0.4 | **1.0** |
| El común | **1.0** | 0.4 | 0.4 |
| Migración y cooperación al desarrollo | **1.0** | — | 0.4 |
| Defensa, geopolítica y seguridad ciudadana | 0.4 | — | **1.0** |
| Medios de comunicación y desinformación | — | **1.0** | — |
| Industria, energía y transición sostenible | — | — | **1.0** |
| Cartera de trabajo de la 4ª Revolución Industrial | — | **1.0** | — |

La repartición final la calcula [`pesoDeSeccion`](../src/lib/capital/ejes.ts) — y se puede auditar con `coberturaSecciones()`.

## Cómo se suman puntos

Las contribuciones del ciudadano ([`src/lib/capital/contribuciones.ts`](../src/lib/capital/contribuciones.ts)) tienen un **valor base**:

| Tipo | Base |
|---|---|
| Vídeo en el Cursus | 8 |
| Recurso en Koiná | 5 |
| Hilo en Ágora | 3 |
| Respuesta en Ágora | 1 |
| PEC recibido | 2 |
| Espacio recuperado | 20 |
| Pin en el mapa | 1 |

Cada tipo reparte esos puntos en los tres ejes con un **reparto por tipo** (cuánto pesa por defecto en cada eje) y, si la contribución está asociada a una sección PHAROS, se suma la mitad del peso de esa sección para modular.

La función inversa `ejeDominante()` devuelve el eje con más puntos y define la **clase** visible en el banner flotante.

## Por qué tres y no cinco

En PHAROS se barajaron más ejes (salud, cuidado, conocimiento, red, influencia…). La decisión de reducir a tres es deliberada:

- Facilita lectura en el banner flotante (una barra por eje cabe a 280 px).
- Evita optimizar métricas que el usuario no entiende.
- Coincide con el esquema clásico de capitales en Bourdieu (social, cultural, simbólico/político) sin importarlo tal cual.

Si en el futuro hace falta un cuarto eje (por ejemplo `oikonomia` para capital económico/productivo local), la interfaz `PesoPorEje` se amplía sin romper contribuciones existentes.
