"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Enlace = { titulo: string; url: string };

/**
 * Editor inline del perfil propio: avatar, biografía y enlaces externos.
 *
 * - Avatar: se sube al bucket `avatars` (creado en la migración) con la ruta
 *   `${userId}/avatar-<ts>.<ext>`, y se guarda la URL pública en
 *   profiles.avatar_url.
 * - Bio: texto libre (profiles.bio).
 * - Enlaces: lista {titulo, url} guardada en profiles.enlaces (jsonb). Si la
 *   columna aún no existe (migración sin aplicar), el guardado de enlaces se
 *   degrada con un aviso, pero bio y avatar sí se guardan.
 */
export function PerfilEditor({
  userId,
  bioInicial,
  enlacesInicial,
  avatarUrlInicial,
}: {
  userId: string;
  bioInicial: string;
  enlacesInicial: Enlace[];
  avatarUrlInicial: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [bio, setBio] = useState(bioInicial);
  const [enlaces, setEnlaces] = useState<Enlace[]>(
    enlacesInicial.length ? enlacesInicial : [],
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrlInicial);
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState("");

  const onAvatar = (f: File | null) => {
    setAvatarFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const setEnlace = (i: number, campo: keyof Enlace, valor: string) => {
    setEnlaces((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)),
    );
  };
  const addEnlace = () =>
    setEnlaces((prev) => [...prev, { titulo: "", url: "" }]);
  const delEnlace = (i: number) =>
    setEnlaces((prev) => prev.filter((_, idx) => idx !== i));

  const guardar = async () => {
    setEstado("guardando");
    setMensaje("");
    const supabase = createClient();

    let nuevaAvatarUrl: string | undefined;

    // 1) Subida de avatar (si hay archivo nuevo).
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const ruta = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from("avatars")
        .upload(ruta, avatarFile, { upsert: true });
      if (errUp) {
        setEstado("error");
        setMensaje(
          "No se pudo subir el avatar. Si el problema persiste, puede que falte crear el almacén de imágenes.",
        );
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(ruta);
      nuevaAvatarUrl = pub.publicUrl;
    }

    // 2) Limpiamos enlaces vacíos.
    const enlacesLimpios = enlaces.filter(
      (e) => e.titulo.trim() && e.url.trim(),
    );

    // 3) Update con enlaces. Si la columna no existe, reintentamos sin ella.
    const baseUpdate: Record<string, unknown> = { bio: bio.trim() };
    if (nuevaAvatarUrl) baseUpdate.avatar_url = nuevaAvatarUrl;

    let { error } = await supabase
      .from("profiles")
      .update({ ...baseUpdate, enlaces: enlacesLimpios })
      .eq("id", userId);

    if (error && /enlaces/i.test(error.message)) {
      // La columna enlaces todavía no existe: guardamos el resto.
      ({ error } = await supabase
        .from("profiles")
        .update(baseUpdate)
        .eq("id", userId));
      if (!error) {
        setEstado("ok");
        setMensaje(
          "Guardado. Los enlaces se activarán cuando se aplique la actualización pendiente de la base de datos.",
        );
        router.refresh();
        return;
      }
    }

    if (error) {
      setEstado("error");
      setMensaje("No se pudo guardar. Inténtalo de nuevo.");
      return;
    }

    setEstado("ok");
    setMensaje("Perfil actualizado.");
    setAvatarFile(null);
    router.refresh();
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="px-4 py-2 rounded-md text-[0.88rem] font-medium"
        style={{
          background: "var(--color-papiro-soft)",
          color: "var(--color-ocre-deep)",
          border: "1px solid var(--color-linea)",
        }}
      >
        Editar perfil
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-5 mt-4"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <h2
        className="display text-[1.05rem] mb-4"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Editar perfil
      </h2>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="rounded-full shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: 64,
            height: 64,
            background: "var(--color-papiro-soft)",
            border: "1px solid var(--color-linea)",
          }}
        >
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span style={{ color: "var(--color-piedra-clara)" }}>—</span>
          )}
        </div>
        <label className="text-[0.86rem] cursor-pointer underline" style={{ color: "var(--color-ocre-deep)" }}>
          Cambiar avatar
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatar(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Bio */}
      <label className="block mb-4">
        <span className="eyebrow block mb-1">Biografía</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="Cuéntale a la comunidad quién eres en pocas líneas."
          className="w-full rounded-md px-3 py-2 text-[0.95rem] outline-none resize-y"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        />
        <span className="text-[0.74rem]" style={{ color: "var(--color-piedra-clara)" }}>
          {bio.length}/400
        </span>
      </label>

      {/* Enlaces */}
      <div className="mb-4">
        <span className="eyebrow block mb-2">Enlaces</span>
        <div className="space-y-2">
          {enlaces.map((e, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={e.titulo}
                onChange={(ev) => setEnlace(i, "titulo", ev.target.value)}
                placeholder="Título"
                className="w-1/3 h-10 rounded-md px-2 text-[0.9rem] outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                  color: "var(--color-papiro-ink)",
                }}
              />
              <input
                type="url"
                value={e.url}
                onChange={(ev) => setEnlace(i, "url", ev.target.value)}
                placeholder="https://…"
                className="flex-1 h-10 rounded-md px-2 text-[0.9rem] outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                  color: "var(--color-papiro-ink)",
                }}
              />
              <button
                type="button"
                onClick={() => delEnlace(i)}
                aria-label="Eliminar enlace"
                className="shrink-0 w-8 h-8 rounded-md"
                style={{
                  border: "1px solid var(--color-linea)",
                  color: "var(--color-piedra)",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {enlaces.length < 6 && (
          <button
            type="button"
            onClick={addEnlace}
            className="mt-2 text-[0.84rem] underline"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            + Añadir enlace
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={guardar}
          disabled={estado === "guardando"}
          className="h-11 px-5 rounded-md font-semibold text-[0.95rem] disabled:opacity-60"
          style={{ background: "var(--color-ocre-deep)", color: "var(--color-surface)" }}
        >
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          disabled={estado === "guardando"}
          className="h-11 px-4 rounded-md text-[0.92rem]"
          style={{
            background: "transparent",
            border: "1px solid var(--color-linea)",
            color: "var(--color-piedra)",
          }}
        >
          Cerrar
        </button>
      </div>

      {mensaje && (
        <p
          className="mt-3 text-[0.88rem]"
          style={{
            color: estado === "error" ? "var(--color-sangre)" : "var(--color-oliva)",
          }}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
