import Link from "next/link";

/**
 * Link a /perfil/[handle] mostrando "@handle" o "@handle · display_name".
 * Reutilizable en cualquier lista (STOA, Ágora, Mensajes, Comentarios).
 *
 * Si no hay handle, muestra "@—" sin link (datos corruptos / autor borrado).
 */
export function AutorLink({
  autor,
  showDisplayName = false,
  className,
}: {
  autor?: {
    handle: string;
    display_name?: string | null;
  };
  showDisplayName?: boolean;
  className?: string;
}) {
  const handle = autor?.handle;
  if (!handle) {
    return (
      <span
        className={className}
        style={{ color: "var(--color-piedra-clara)" }}
      >
        @—
      </span>
    );
  }
  return (
    <Link
      href={`/perfil/${handle}`}
      className={`hover:underline ${className || ""}`}
      style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
    >
      @{handle}
      {showDisplayName && autor?.display_name && (
        <span
          className="ml-1"
          style={{ color: "var(--color-piedra)", fontWeight: 400 }}
        >
          · {autor.display_name}
        </span>
      )}
    </Link>
  );
}
