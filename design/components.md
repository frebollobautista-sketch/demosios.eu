# KOINOS · Componentes UI v1

> Documentación de los 5 primitivos base. Cada uno vive en
> `src/components/ui/` y se importa con `import { ... } from "@/components/ui"`.
> Esta página replica la API + código fuente para que `/design` sea
> autosuficiente. Si hay drift contra `src/components/ui/`, gana el código
> ejecutado — sincroniza este archivo tras cualquier cambio.
>
> Página showcase viva: `localhost:3000/sistema`.

## Índice

- [Button](#button)
- [Card](#card)
- [Input](#input)
- [Pill](#pill)
- [StatCard](#statcard)

---

## Button

**Uso**: el botón base de toda interacción. Cuatro variantes y tres tamaños. Acepta cualquier prop nativa de `<button>` (incluido `onClick`, `disabled`, `type`, `aria-*`).

### API

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;        // default: "primary"
  size?: ButtonSize;              // default: "md"
  leadingIcon?: ReactNode;        // ícono iso 16 a la izquierda
  trailingIcon?: ReactNode;       // ícono iso 16 a la derecha
}
```

### Variantes

| Variante | Fondo | Texto | Borde | Cuándo usar |
|---|---|---|---|---|
| `primary` | `--ocre` | `--paper` | `--ocre` | Acción principal de la pantalla |
| `secondary` | white | `--volcanic` | `--line` | Acción secundaria, cancelar |
| `ghost` | transparente | `--ocre` | transparente | Acciones terciarias, menús |
| `danger` | transparente | `--terracotta` | `--terracotta` | Acciones destructivas (eliminar, salir) |

### Tamaños

| Size | Altura | Padding | Texto |
|---|---|---|---|
| `sm` | 32px | 12px | 13px |
| `md` | 40px | 16px | 14px |
| `lg` | 48px | 24px | 16px |

### Ejemplos

```tsx
<Button>Confirmar</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="danger" onClick={borrar}>Eliminar</Button>
<Button size="lg" leadingIcon={<ArrowIcon />}>Continuar</Button>
```

---

## Card

**Uso**: contenedor base. Tres variantes según el fondo sobre el que se sitúa y la jerarquía que necesite.

### API

```ts
type CardVariant = "surface" | "elevated" | "outlined";
type CardPadding = "tight" | "default" | "generous" | "none";
type CardAccent = "ocre" | "terracotta" | "laurel" | "blue-dk" | "gold";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;          // default: "outlined"
  padding?: CardPadding;          // default: "default"
  accent?: CardAccent;            // franja izquierda opcional, 3px
}
```

### Variantes

| Variante | Fondo | Borde | Sombra | Cuándo usar |
|---|---|---|---|---|
| `surface` | `--paper` | — | — | Card sobre `--cream` (mismo plano visual) |
| `elevated` | white | — | sutil | Card sobre `--paper` (con jerarquía) |
| `outlined` | white | 0.5px `--line` | — | Listas densas, grids tabulares |

### Accent

La prop `accent` dibuja una franja izquierda de 3px en uno de los 5 colores semánticos. Útil para:
- `ocre` — info / dato general
- `terracotta` — alerta / dato negativo
- `laurel` — éxito / dato positivo
- `blue-dk` — link / referencia externa
- `gold` — premio / hito

### Ejemplos

```tsx
<Card>
  <h3>Sección 052</h3>
  <p>Las Canteras · 345 viviendas</p>
</Card>

<Card variant="elevated" padding="generous">
  <p>Card destacada con sombra sutil.</p>
</Card>

<Card variant="outlined" accent="terracotta">
  <p>Aviso con franja roja a la izquierda.</p>
</Card>
```

---

## Input

**Uso**: campo de texto base. Soporta texto, búsqueda con ícono, label, mensaje de error.

### API

```ts
type InputVariant = "text" | "search";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: InputVariant;     // default: "text"
  error?: string;             // si presente, marca borde --terracotta
  icon?: ReactNode;           // ícono a la izquierda (14-16px)
  label?: string;             // etiqueta arriba opcional
}
```

### Variantes

| Variante | Forma | Cuándo usar |
|---|---|---|
| `text` | rectángulo `--radius-lg` | Formularios estándar |
| `search` | pill `--radius-full` | Búsquedas, filtros |

### Estados visuales

| Estado | Borde | Ring |
|---|---|---|
| default | 0.5px `--line` | — |
| focused | 1px `--ocre` | 3px `--ocre/20%` |
| error | 1px `--terracotta` | 3px `--terracotta/20%` |

### Ejemplos

```tsx
<Input label="Nombre" placeholder="Tu nombre" />

<Input
  variant="search"
  placeholder="Buscar farmacia, restaurante…"
  icon={<SearchIcon />}
/>

<Input
  label="cusec"
  defaultValue="35-016-09999"
  error="Debe tener 10 dígitos sin guiones"
  className="font-mono"
/>
```

---

## Pill

**Uso**: chip / tag / pill para filtros, categorías y badges.

### API

```ts
type PillCategory =
  | "restauracion" | "comercio" | "alojamiento" | "salud"
  | "finanzas" | "residencial" | "publico" | "monumento";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;          // estado seleccionado (filtros)
  category?: PillCategory;   // forma de categoría (color fijo)
  withDot?: boolean;         // punto decorativo izquierdo (default true en categoría)
}
```

### Variantes

#### Filtro neutral / activo

```tsx
<Pill>Todos</Pill>          // default — bg cream, border sand
<Pill active>Salud</Pill>   // active — bg volcanic, text paper
```

#### Categoría con color semántico

La paleta categórica es **fija** y debe coincidir con `polis-juego/` y los visualizadores de POIs:

| Categoría | Color |
|---|---|
| `restauracion` | `--terracotta` (#c85438) |
| `comercio` | `--blue-dk` (#3a5878) |
| `alojamiento` | `--sangre` (#6e2a1e) |
| `salud` | `--laurel` (#7c8a4a) |
| `finanzas` | `--gold` (#d8a44a) |
| `residencial` | `--ocre` (#b07840) |
| `publico` | `--aegean` (#5b9aa8) |
| `monumento` | `--volcanic` (#221d18, dot dorado) |

```tsx
<Pill category="restauracion">Restauración</Pill>
<Pill category="salud">Salud</Pill>
```

---

## StatCard

**Uso**: tarjeta de estadística — número grande con eyebrow inferior. Para grids de mini-stats o resaltes con franja.

### API

```ts
interface StatCardProps {
  value: ReactNode;          // número o cifra (string o nodo)
  label: string;             // eyebrow inferior (uppercase + 0.18em)
  accent?: "ocre" | "terracotta" | "laurel" | "blue-dk" | "gold";
  delta?: { value: string; positive?: boolean };  // cambio bajo el número
  className?: string;
}
```

### Variantes

#### Mini-stat (sin accent)

Número 24px, label debajo. Para grids tipo dashboard.

```tsx
<StatCard value={345} label="Viviendas" />
<StatCard value="41,2 ha" label="Superficie" />
```

#### Stat resaltado (con accent + delta)

Número 28px, eyebrow arriba, franja izquierda 3px, delta opcional debajo.

```tsx
<StatCard
  value="28.450 €"
  label="Renta media"
  accent="ocre"
  delta={{ value: "+8,2% sobre 2022 · INE", positive: true }}
/>

<StatCard
  value="12,4 %"
  label="Vivienda vacacional"
  accent="terracotta"
  delta={{ value: "+3,1 pp sobre 2022 · ISTAC" }}
/>
```

### Tipografía

El número siempre va en `--font-mono` con `tabular-nums` activado. Esto garantiza que columnas de StatCards alineen perfectamente sus dígitos cuando se ponen en grid.

---

## Convenciones comunes

- **Server Components compatible**: estos primitivos no usan `useState` ni hooks. El parent decide si necesita `"use client"`.
- **Type-safe**: cada componente exporta sus props como tipo nombrado.
- **Tokens, no literales**: ningún color hex está hardcoded en los componentes — todos consumen variables de `tokens.css`.
- **Focus visible**: todos los elementos interactivos tienen ring de foco con `--ocre/25%`.
- **Reduced motion**: las transiciones se desactivan automáticamente vía la regla global `@media (prefers-reduced-motion: reduce)` en `globals.css`.

## Para extender

1. **Añadir variante a un componente existente**: edita el record `variantClass` (o equivalente) en `src/components/ui/<Name>.tsx`. Documenta aquí. Añade ejemplo en `src/app/sistema/page.tsx`.
2. **Crear un componente nuevo**: archivo en `src/components/ui/`, re-exportar en `index.ts`, documentar aquí, ejemplo en showcase.
3. **Cambiar paleta categórica**: requiere actualizar también `polis-juego/` y SISTEMA.md §2.
