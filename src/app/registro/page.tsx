import { Suspense } from "react";
import Link from "next/link";
import { RegistroForm } from "./RegistroForm";

export default function RegistroPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12 pb-40">
      <div className="eyebrow">Crear cuenta en OCRE</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Una cuenta para sostener el común
      </h1>
      <p
        className="mt-3 text-[0.95rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        Pedimos lo mínimo: correo, contraseña y un nombre de usuario. Ni
        DNI ni dirección. El barrio lo eliges después en tus ajustes si
        quieres aparecer en los hilos de tu zona.
      </p>

      <Suspense fallback={<div className="mt-6 h-11" aria-hidden />}>
        <RegistroForm />
      </Suspense>

      <p
        className="mt-8 text-[0.82rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Entra aquí
        </Link>
        . ·{" "}
        <Link
          href="/"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Volver a Inicio
        </Link>
        .
      </p>
    </div>
  );
}
