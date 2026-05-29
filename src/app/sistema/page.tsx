/**
 * KOINOS · /sistema
 * -----------------
 * Página showcase del sistema de diseño. Muestra todos los componentes UI
 * con sus variantes y props, sirviendo como prueba viva y referencia para
 * el equipo. Abrir en localhost:3000/sistema.
 *
 * No tiene navegación ni layout especial — es deliberadamente plana para
 * que sea fácil añadir nuevos componentes a medida que el sistema crece.
 */

"use client";

import { Button, Card, Input, Pill, StatCard } from "@/components/ui";

function Section({
  title,
  index,
  children,
}: {
  title: string;
  index: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="text-[11px] tracking-[0.18em] uppercase text-ocre-dk font-medium mb-1">
        {index} · {title}
      </div>
      <div className="bg-paper rounded-xl p-6">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono text-piedra mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

export default function SistemaPage() {
  return (
    <main className="min-h-screen bg-bg-soft px-6 py-10 sm:px-12 sm:py-14">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <div className="text-[11px] tracking-[0.18em] uppercase text-ocre-dk font-medium mb-2">
            KOINOS · sistema de diseño
          </div>
          <h1 className="display text-[48px] leading-[1.1] text-volcanic mb-3">
            Componentes base
          </h1>
          <p className="text-base text-piedra max-w-2xl leading-relaxed">
            Museo navegable de los primitivos UI. Cada componente vive en{" "}
            <code className="font-mono text-[13px] text-ocre-dk">
              src/components/ui/
            </code>
            . Los tokens vienen de{" "}
            <code className="font-mono text-[13px] text-ocre-dk">
              src/app/globals.css
            </code>
            . Para añadir uno nuevo: documenta en{" "}
            <code className="font-mono text-[13px] text-ocre-dk">
              design/SISTEMA.md
            </code>{" "}
            §8 antes de mergear.
          </p>
        </header>

        <Section index="01" title="Button">
          <Label>Variantes — md (default)</Label>
          <div className="flex gap-2.5 flex-wrap items-center">
            <Button variant="primary">Confirmar acción</Button>
            <Button variant="secondary">Cancelar</Button>
            <Button variant="ghost">Más opciones</Button>
            <Button variant="danger">Eliminar</Button>
            <Button variant="primary" disabled>
              Deshabilitado
            </Button>
          </div>

          <Label>Tamaños — sm · md · lg</Label>
          <div className="flex gap-2.5 flex-wrap items-center">
            <Button size="sm">Pequeño</Button>
            <Button size="md">Estándar</Button>
            <Button size="lg">Grande</Button>
          </div>

          <Label>Con ícono · stroke="currentColor"</Label>
          <div className="flex gap-2.5 flex-wrap items-center">
            <Button
              leadingIcon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              }
            >
              Continuar
            </Button>
            <Button
              variant="secondary"
              leadingIcon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m13 13-2.5-2.5" />
                </svg>
              }
            >
              Buscar
            </Button>
          </div>
        </Section>

        <Section index="02" title="Card">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card variant="surface">
              <div className="font-medium text-[14px] text-volcanic mb-1">
                Sección 052
              </div>
              <div className="text-[13px] text-ocre-dk">
                Las Canteras · 345 viviendas · 41,2 ha.
              </div>
            </Card>
            <Card variant="elevated">
              <div className="font-medium text-[14px] text-volcanic mb-1">
                Sección 052
              </div>
              <div className="text-[13px] text-piedra">
                Las Canteras · 345 viviendas · 41,2 ha.
              </div>
            </Card>
            <Card variant="outlined">
              <div className="font-medium text-[14px] text-volcanic mb-1">
                Sección 052
              </div>
              <div className="text-[13px] text-piedra">
                Las Canteras · 345 viviendas · 41,2 ha.
              </div>
            </Card>
          </div>
        </Section>

        <Section index="03" title="Input">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre" placeholder="Tu nombre" />
            <Input
              variant="search"
              placeholder="Buscar farmacia, restaurante…"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m13 13-2.5-2.5" />
                </svg>
              }
            />
            <Input
              label="cusec"
              defaultValue="35-016-09999"
              error="El cusec debe tener 10 dígitos sin guiones"
              className="font-mono"
            />
            <Input label="Email" type="email" placeholder="tu@email.es" />
          </div>
        </Section>

        <Section index="04" title="Pill / chip">
          <Label>Filtros — neutral · seleccionado</Label>
          <div className="flex gap-2 flex-wrap items-center">
            <Pill active>Todos</Pill>
            <Pill>Comercio</Pill>
            <Pill>Restauración</Pill>
            <Pill>Salud</Pill>
            <Pill>Alojamiento</Pill>
          </div>

          <Label>Categoría · paleta semántica KOINOS</Label>
          <div className="flex gap-2 flex-wrap items-center">
            <Pill category="restauracion">Restauración</Pill>
            <Pill category="comercio">Comercio</Pill>
            <Pill category="alojamiento">Alojamiento</Pill>
            <Pill category="salud">Salud</Pill>
            <Pill category="finanzas">Finanzas</Pill>
            <Pill category="residencial">Residencial</Pill>
            <Pill category="publico">Público</Pill>
            <Pill category="monumento">Monumento</Pill>
          </div>
        </Section>

        <Section index="05" title="Stat-card">
          <Label>Mini-stats · grid simple</Label>
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-5">
            <StatCard value="28.450" label="renta €/año" />
            <StatCard value="345" label="viviendas" />
            <StatCard value="38" label="POIs" />
            <StatCard value="154" label="árboles" />
            <StatCard value="47" label="manzanas" />
          </div>

          <Label>Stat con accent + delta</Label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <StatCard
              value="28.450 €"
              label="renta media"
              accent="ocre"
              delta={{ value: "+8,2% sobre 2022 · INE", positive: true }}
            />
            <StatCard
              value="12,4 %"
              label="vivienda vacacional"
              accent="terracotta"
              delta={{ value: "+3,1 pp sobre 2022 · ISTAC" }}
            />
          </div>
        </Section>
      </div>
    </main>
  );
}
