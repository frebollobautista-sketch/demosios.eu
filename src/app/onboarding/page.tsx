"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, User, Sparkles, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CANARIAS } from "@/lib/territorio/canarias";
import {
  HANDLE_REGEX,
  handleDisponible,
  normalizarHandle,
} from "@/lib/auth/handle";

const C = {
  bg: "#FAF7F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F3EFEC",
  border: "#E8E2DD",
  primary: "#FF6B6B",
  secondary: "#7C5CFC",
  accent: "#3DBBF0",
  text: "#2D2926",
  textMuted: "#7A7067",
  textDim: "#A89F97",
  semGreen: "#2ECC87",
  semYellow: "#FFB347",
  semRed: "#FF6B6B",
  gold: "#D4AF37",
};

const AVATAR_COLORS = [
  "#FF6B6B",
  "#7C5CFC",
  "#3DBBF0",
  "#2ECC87",
  "#FFB347",
  "#D4AF37",
  "#FF8A65",
  "#AB47BC",
];

const INTERESTS = [
  "tecnología",
  "filosofía",
  "arte",
  "música",
  "naturaleza",
  "política",
  "deporte",
  "ciencia",
  "literatura",
  "cine",
  "fotografía",
  "historia",
];

function selectStyle(c: typeof C): React.CSSProperties {
  return {
    width: "100%",
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 15,
    color: c.text,
    background: c.surfaceAlt,
    outline: "none",
    boxSizing: "border-box",
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [transitioning, setTransitioning] = useState(false);

  // Step 1 fields
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [handleDispo, setHandleDispo] = useState<
    "idle" | "comprobando" | "disponible" | "ocupado" | "error"
  >("idle");
  const handleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInicial = useRef<string>("");
  const [avatarMode, setAvatarMode] = useState<"photo" | "initial">("initial");
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarInitial, setAvatarInitial] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Step 2 fields
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsError, setInterestsError] = useState("");
  const [islaId, setIslaId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  // Auth check + prefill desde el perfil (creado por el trigger handle_new_user).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      const { data: perfil } = await supabase
        .from("profiles")
        .select(
          "handle, display_name, avatar_color, onboarding_completed",
        )
        .eq("id", data.user.id)
        .maybeSingle();
      if (perfil?.onboarding_completed) {
        router.replace("/perfil");
        return;
      }
      if (perfil?.handle) {
        const h = normalizarHandle(perfil.handle);
        setHandle(h);
        handleInicial.current = h;
      }
      if (perfil?.display_name) setDisplayName(perfil.display_name);
      if (perfil?.avatar_color) setAvatarColor(perfil.avatar_color);
      const inicialBase =
        perfil?.display_name?.[0] || perfil?.handle?.[0] || "";
      if (inicialBase) setAvatarInitial(inicialBase.toUpperCase());
      setLoading(false);
    });
  }, [router]);

  // Validation
  const validateHandle = (v: string) => {
    if (!v) return "El nombre de usuario es obligatorio";
    if (v.length < 3) return "Mínimo 3 caracteres";
    if (v.length > 30) return "Máximo 30 caracteres";
    if (!HANDLE_REGEX.test(v))
      return "Solo minúsculas, números y guión bajo (_)";
    return "";
  };

  // Comprobación debounced de disponibilidad del handle.
  useEffect(() => {
    if (handleDebounce.current) clearTimeout(handleDebounce.current);
    if (!handle || validateHandle(handle)) {
      setHandleDispo("idle");
      return;
    }
    // Si no ha cambiado respecto al que ya tiene, está libre para él.
    if (handle === handleInicial.current) {
      setHandleDispo("disponible");
      return;
    }
    setHandleDispo("comprobando");
    handleDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const r = await handleDisponible(supabase, handle);
      setHandleDispo(
        r === "disponible" ? "disponible" : r === "ocupado" ? "ocupado" : "error",
      );
    }, 350);
    return () => {
      if (handleDebounce.current) clearTimeout(handleDebounce.current);
    };
  }, [handle]);

  const step1Valid =
    handle.length >= 3 &&
    handle.length <= 30 &&
    HANDLE_REGEX.test(handle) &&
    handleDispo !== "ocupado" &&
    handleDispo !== "comprobando" &&
    (avatarMode === "photo" ? !!avatarPhoto : !!avatarInitial);

  const step2Valid = interests.length >= 1;

  const islaSel = CANARIAS.find((i) => i.id === islaId);
  const muniSel = islaSel?.municipios.find((m) => m.id === municipioId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorGuardar("La imagen no puede superar 5 MB.");
      return;
    }
    setErrorGuardar("");
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPhoto(reader.result as string);
      setAvatarMode("photo");
    };
    reader.readAsDataURL(file);
  };

  const goToStep2 = () => {
    const err = validateHandle(handle);
    if (err) {
      setHandleError(err);
      return;
    }
    if (!step1Valid) return;
    setTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setTransitioning(false);
    }, 250);
  };

  const goToStep1 = () => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(1);
      setTransitioning(false);
    }, 250);
  };

  const toggleInterest = (i: string) => {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
    setInterestsError("");
  };

  const handleSubmit = async () => {
    if (interests.length < 1) {
      setInterestsError("Selecciona al menos un interés");
      return;
    }
    if (!userId) return;
    setGuardando(true);
    setErrorGuardar("");
    const supabase = createClient();

    try {
      // 1) Si eligió foto, súbela a Storage (bucket 'avatars').
      let avatarUrl: string | null = null;
      if (avatarMode === "photo" && avatarFile) {
        const ext = (avatarFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, cacheControl: "3600" });
        if (up.error) {
          throw new Error(
            "No hemos podido subir la foto. ¿Existe el bucket 'avatars'? Puedes continuar con un avatar de inicial.",
          );
        }
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path)
          .data.publicUrl;
      }

      // 2) Actualiza el perfil (la fila ya existe por el trigger).
      const update: Record<string, unknown> = {
        handle,
        display_name: displayName || null,
        bio: bio || null,
        interests,
        avatar_color: avatarColor,
        isla_id: islaId || null,
        municipio_id: municipioId || null,
        barrio_id: barrioId || null,
        onboarding_completed: true,
      };
      if (avatarUrl) update.avatar_url = avatarUrl;

      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (error) {
        if (error.code === "23505") {
          setStep(1);
          setHandleDispo("ocupado");
          throw new Error("Ese nombre de usuario ya está cogido. Elige otro.");
        }
        throw new Error(
          "No hemos podido guardar tu perfil. Inténtalo de nuevo en un momento.",
        );
      }

      // 3) Sincroniza el handle en los metadatos de auth (best-effort).
      await supabase.auth.updateUser({ data: { handle } });

      router.push("/perfil");
      router.refresh();
    } catch (e) {
      setErrorGuardar(
        e instanceof Error ? e.message : "Algo ha fallado. Inténtalo de nuevo.",
      );
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={32} color={C.secondary} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 375 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Sparkles
            size={28}
            color={C.secondary}
            style={{ marginBottom: 8 }}
          />
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: C.text,
              margin: "0 0 6px",
            }}
          >
            Bienvenido a OCRE
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
            Configura tu perfil para empezar
          </p>
        </div>

        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 28,
          }}
        >
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: s <= step ? C.secondary : C.border,
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        <p
          style={{
            fontSize: 12,
            color: C.textDim,
            margin: "0 0 16px",
            textAlign: "center",
          }}
        >
          Paso {step} de 2
        </p>

        {/* Card */}
        <div
          style={{
            background: C.surface,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: 24,
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? "translateX(-20px)" : "translateX(0)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
          }}
        >
          {step === 1 && (
            <>
              {/* Handle */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                Handle *
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: `1px solid ${handleError ? C.semRed : C.border}`,
                  borderRadius: 10,
                  padding: "0 12px",
                  marginBottom: handleError ? 4 : 16,
                  background: C.surfaceAlt,
                }}
              >
                <span style={{ color: C.textDim, fontSize: 15 }}>@</span>
                <input
                  type="text"
                  value={handle}
                  maxLength={30}
                  placeholder="tu_handle"
                  onChange={(e) => {
                    const v = normalizarHandle(e.target.value);
                    setHandle(v);
                    setHandleError(validateHandle(v));
                  }}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    padding: "10px 8px",
                    fontSize: 15,
                    color: C.text,
                  }}
                />
              </div>
              {handleError ? (
                <p style={{ fontSize: 12, color: C.semRed, margin: "0 0 12px" }}>
                  {handleError}
                </p>
              ) : (
                handle &&
                handleDispo !== "idle" && (
                  <p
                    style={{
                      fontSize: 12,
                      margin: "0 0 12px",
                      color:
                        handleDispo === "disponible"
                          ? C.semGreen
                          : handleDispo === "comprobando"
                            ? C.textDim
                            : C.semRed,
                    }}
                  >
                    {handleDispo === "comprobando" && "Comprobando…"}
                    {handleDispo === "disponible" && "✓ Disponible"}
                    {handleDispo === "ocupado" && "Ya está cogido. Prueba con otro."}
                    {handleDispo === "error" &&
                      "No se pudo comprobar; lo validaremos al guardar."}
                  </p>
                )
              )}

              {/* Avatar */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 10,
                }}
              >
                Avatar *
              </label>

              {/* Mode toggle */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => setAvatarMode("initial")}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: `1px solid ${avatarMode === "initial" ? C.secondary : C.border}`,
                    background:
                      avatarMode === "initial" ? `${C.secondary}15` : C.surface,
                    color:
                      avatarMode === "initial" ? C.secondary : C.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <User size={14} /> Inicial
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarMode("photo")}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: `1px solid ${avatarMode === "photo" ? C.secondary : C.border}`,
                    background:
                      avatarMode === "photo" ? `${C.secondary}15` : C.surface,
                    color: avatarMode === "photo" ? C.secondary : C.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Camera size={14} /> Foto
                </button>
              </div>

              {avatarMode === "initial" ? (
                <div>
                  {/* Color picker */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: c,
                          border:
                            avatarColor === c
                              ? `3px solid ${C.text}`
                              : "3px solid transparent",
                          cursor: "pointer",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {avatarColor === c && (
                          <Check size={14} color="#fff" />
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Initial input */}
                  <input
                    type="text"
                    value={avatarInitial}
                    maxLength={1}
                    placeholder="Tu inicial"
                    onChange={(e) =>
                      setAvatarInitial(e.target.value.toUpperCase())
                    }
                    style={{
                      width: "100%",
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 15,
                      color: C.text,
                      background: C.surfaceAlt,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {/* Preview */}
                  {avatarInitial && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: avatarColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {avatarInitial}
                      </div>
                      <span
                        style={{ fontSize: 13, color: C.textMuted }}
                      >
                        Vista previa
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 10,
                      border: `2px dashed ${C.border}`,
                      background: C.surfaceAlt,
                      color: C.textMuted,
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Camera size={18} />
                    {avatarPhoto ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {avatarPhoto && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <img
                        src={avatarPhoto}
                        alt="Avatar"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                      <span
                        style={{ fontSize: 13, color: C.textMuted }}
                      >
                        Vista previa
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Display name */}
              <div style={{ marginTop: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 6,
                  }}
                >
                  Nombre para mostrar{" "}
                  <span style={{ color: C.textDim, fontWeight: 400 }}>
                    (opcional)
                  </span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  maxLength={50}
                  placeholder="Tu nombre"
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 15,
                    color: C.text,
                    background: C.surfaceAlt,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Next button */}
              <button
                type="button"
                onClick={goToStep2}
                disabled={!step1Valid}
                style={{
                  width: "100%",
                  marginTop: 24,
                  padding: "13px 0",
                  borderRadius: 12,
                  border: "none",
                  background: step1Valid ? C.secondary : C.border,
                  color: step1Valid ? "#fff" : C.textDim,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: step1Valid ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.2s ease",
                }}
              >
                Siguiente <ArrowRight size={16} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Bio */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                Bio{" "}
                <span style={{ color: C.textDim, fontWeight: 400 }}>
                  (opcional)
                </span>
              </label>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <textarea
                  value={bio}
                  maxLength={300}
                  placeholder="Cuéntanos algo sobre ti..."
                  rows={3}
                  onChange={(e) => setBio(e.target.value)}
                  style={{
                    width: "100%",
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 15,
                    color: C.text,
                    background: C.surfaceAlt,
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 12,
                    fontSize: 11,
                    color: bio.length > 270 ? C.semRed : C.textDim,
                  }}
                >
                  {bio.length}/300
                </span>
              </div>

              {/* Barrio (opcional) */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                Tu barrio{" "}
                <span style={{ color: C.textDim, fontWeight: 400 }}>
                  (opcional)
                </span>
              </label>
              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                <select
                  value={islaId}
                  onChange={(e) => {
                    setIslaId(e.target.value);
                    setMunicipioId("");
                    setBarrioId("");
                  }}
                  style={selectStyle(C)}
                >
                  <option value="">Elige tu isla…</option>
                  {CANARIAS.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.emoji} {i.nombre}
                    </option>
                  ))}
                </select>
                {islaSel && (
                  <select
                    value={municipioId}
                    onChange={(e) => {
                      setMunicipioId(e.target.value);
                      setBarrioId("");
                    }}
                    style={selectStyle(C)}
                  >
                    <option value="">Elige tu municipio…</option>
                    {islaSel.municipios.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                )}
                {muniSel && muniSel.barrios.length > 0 && (
                  <select
                    value={barrioId}
                    onChange={(e) => setBarrioId(e.target.value)}
                    style={selectStyle(C)}
                  >
                    <option value="">Elige tu barrio…</option>
                    {muniSel.barrios.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Interests */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 6,
                }}
              >
                Intereses *{" "}
                <span style={{ color: C.textDim, fontWeight: 400 }}>
                  (mínimo 1)
                </span>
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: interestsError ? 4 : 16,
                }}
              >
                {INTERESTS.map((item) => {
                  const selected = interests.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInterest(item)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: `1px solid ${selected ? C.secondary : C.border}`,
                        background: selected ? `${C.secondary}15` : C.surface,
                        color: selected ? C.secondary : C.text,
                        fontSize: 13,
                        fontWeight: selected ? 600 : 400,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {selected && <Check size={13} />}
                      {item}
                    </button>
                  );
                })}
              </div>
              {interestsError && (
                <p
                  style={{
                    fontSize: 12,
                    color: C.semRed,
                    margin: "0 0 12px",
                  }}
                >
                  {interestsError}
                </p>
              )}

              {/* Buttons */}
              <div
                style={{ display: "flex", gap: 10, marginTop: 20 }}
              >
                <button
                  type="button"
                  onClick={goToStep1}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.textMuted,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!step2Valid || guardando}
                  style={{
                    flex: 2,
                    padding: "13px 0",
                    borderRadius: 12,
                    border: "none",
                    background: step2Valid && !guardando ? C.secondary : C.border,
                    color: step2Valid && !guardando ? "#fff" : C.textDim,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: step2Valid && !guardando ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "background 0.2s ease",
                  }}
                >
                  {guardando ? "Guardando…" : "Empezar"} <Sparkles size={16} />
                </button>
              </div>
              {errorGuardar && (
                <p
                  style={{
                    fontSize: 12,
                    color: C.semRed,
                    margin: "12px 0 0",
                    textAlign: "center",
                  }}
                >
                  {errorGuardar}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
