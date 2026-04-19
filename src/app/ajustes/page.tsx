export default function AjustesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Preferencias</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.2vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Ajustes
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Aún por cablear. Aquí vivirán avatar, territorio por defecto,
        visibilidad del banner flotante, notificaciones y baja del
        boletín.
      </p>
    </div>
  );
}
