"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Camera, User, Sparkles, ArrowRight, Check } from "lucide-react";

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

const HANDLE_REGEX = /^[a-z0-9._]+$/;

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [transitioning, setTransitioning] = useState(false);

  // Step 1 fields
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [avatarMode, setAvatarMode] = useState<"photo" | "initial">("initial");
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarInitial, setAvatarInitial] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Step 2 fields
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsError, setInterestsError] = useState("");

  // Auth check
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  // Validation
  const validateHandle = (v: string) => {
    if (!v) return "El handle es obligatorio";
    if (v.length < 3) return "Mínimo 3 caracteres";
    if (v.length > 30) return "Máximo 30 caracteres";
    if (!HANDLE_REGEX.test(v)) return "Solo letras minúsculas, números, puntos y guiones bajos";
    return "";
  };

  const step1Valid =
    handle.length >= 3 &&
    handle.length <= 30 &&
    HANDLE_REGEX.test(handle) &&
    (avatarMode === "photo" ? !!avatarPhoto : !!avatarInitial);

  const step2Valid = interests.length >= 1;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const handleSubmit = () => {
    if (interests.length < 1) {
      setInterestsError("Selecciona al menos un interés");
      return;
    }
    const data = {
      handle,
      avatarMode,
      avatarPhoto: avatarMode === "photo" ? avatarPhoto : null,
      avatarColor: avatarMode === "initial" ? avatarColor : null,
      avatarInitial: avatarMode === "initial" ? avatarInitial : null,
      displayName: displayName || null,
      bio: bio || null,
      interests,
    };
    console.log("Onboarding data:", data);
    router.push("/feed");
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
            Bienvenido a KOINOS
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
                    const v = e.target.value.toLowerCase();
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
              {handleError && (
                <p
                  style={{
                    fontSize: 12,
                    color: C.semRed,
                    margin: "0 0 12px",
                  }}
                >
                  {handleError}
                </p>
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
                  disabled={!step2Valid}
                  style={{
                    flex: 2,
                    padding: "13px 0",
                    borderRadius: 12,
                    border: "none",
                    background: step2Valid ? C.secondary : C.border,
                    color: step2Valid ? "#fff" : C.textDim,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: step2Valid ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "background 0.2s ease",
                  }}
                >
                  Empezar <Sparkles size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
