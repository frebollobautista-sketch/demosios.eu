import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12 pb-40">
      <div className="eyebrow">Entrar a OCRE</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Te mandamos un enlace al correo
      </h1>
      <p
        className="mt-3 text-[0.95rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        Sin contraseña. Introduces tu email, te llega un enlace, pulsas y entras.
        Tu sesión dura hasta que cierres.
      </p>

      {/* Suspense obligatorio: LoginForm lee searchParams en cliente (useSearchParams),
          y el prerender estático necesita un boundary para poder partir el shell. */}
      <Suspense fallback={<div className="mt-6 h-11" aria-hidden />}>
        <LoginForm />
      </Suspense>

      <p
        className="mt-8 text-[0.82rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Volver a{" "}
        <Link
          href="/"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Inicio
        </Link>
        .
      </p>
    </div>
  );
}
