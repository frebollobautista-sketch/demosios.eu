// shared/perfil-panel.js — Panel del avatar ("cursus honorum") para los
// apps estáticos. Iteración 1.
//
// Comportamiento:
//  · Persona NUEVA (sin sesión): el panel le devuelve su rastro anónimo
//    (gestos en localStorage) + su grado en el cursus, e invita a
//    registrarse (email + contraseña + handle, igual que el sitio Next).
//  · Persona REGISTRADA: muestra handle + grado + cerrar sesión.
//
// Se auto-inicializa al importarse: localiza el avatar FAB (#app-topbar-enter),
// le ata el click y mantiene su estado (data-registered + insignia) según
// la sesión de Supabase. Un solo `import` por app basta.

import { getSession, getProfile, onAuthChange, signUp, signIn, signOut, HANDLE_RE }
  from "./auth.js?v=20260601-perfil1";
import { getAllGestos } from "./gestos.js";

/* ── Cursus: grado a partir del nº de gestos (ajustable) ─────────────── */
const GRADOS = [
  { min: 0,  nombre: "Visitante",   sub: "empieza tu cursus" },
  { min: 1,  nombre: "Aprendiz",    sub: "primeros gestos" },
  { min: 4,  nombre: "Vecino/a",    sub: "presencia en el barrio" },
  { min: 12, nombre: "Ciudadano/a", sub: "voz reconocida" },
  { min: 30, nombre: "Patricio/a",  sub: "referente cívico" },
];
function cursus(n) {
  let g = GRADOS[0];
  for (const x of GRADOS) if (n >= x.min) g = x;
  return g;
}
function contarGestos() {
  try { return (getAllGestos() || []).length; } catch { return 0; }
}

/* ── CSS (inyectado una vez) ─────────────────────────────────────────── */
const CSS = `
.knp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;
  opacity:0;transition:opacity .2s;pointer-events:none;}
.knp-backdrop.open{opacity:1;pointer-events:auto;}
.knp-panel{position:fixed;z-index:1001;background:#FBF7EE;color:#221D18;
  font-family:Georgia,"Times New Roman",serif;display:flex;flex-direction:column;
  box-shadow:0 8px 40px rgba(0,0,0,.35);transition:transform .25s cubic-bezier(.4,0,.2,1);}
@media(min-width:721px){.knp-panel{top:0;right:0;bottom:0;width:380px;max-width:90vw;
  transform:translateX(100%);border-left:1px solid #e3dccb;}
  .knp-panel.open{transform:translateX(0);}}
@media(max-width:720px){.knp-panel{left:0;right:0;bottom:0;max-height:88vh;
  border-radius:16px 16px 0 0;transform:translateY(100%);border-top:1px solid #e3dccb;}
  .knp-panel.open{transform:translateY(0);}}
.knp-head{display:flex;align-items:center;justify-content:space-between;
  padding:16px 18px;border-bottom:1px solid #eee4d0;}
.knp-head h2{margin:0;font-size:1.05rem;font-weight:600;letter-spacing:.02em;}
.knp-x{appearance:none;border:none;background:transparent;font-size:1.5rem;
  line-height:1;cursor:pointer;color:#8a7a5e;padding:2px 8px;border-radius:6px;}
.knp-x:hover{background:#efe6d4;color:#221D18;}
.knp-body{padding:18px;overflow-y:auto;}
.knp-cursus{background:#221D18;color:#FBF7EE;border-radius:12px;padding:16px 18px;
  margin-bottom:18px;}
.knp-grado{font-size:1.35rem;font-weight:600;}
.knp-grado small{display:block;font-size:.78rem;opacity:.7;font-weight:400;margin-top:2px;}
.knp-rastro{font-size:.86rem;color:#a99b80;margin-top:10px;font-family:ui-monospace,Menlo,monospace;}
.knp-lead{font-size:.95rem;line-height:1.5;color:#5a503f;margin:0 0 16px;}
.knp-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;}
.knp-field label{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#8a7a5e;}
.knp-field input{font:inherit;font-size:.95rem;padding:9px 11px;border:1px solid #d8cdb4;
  border-radius:8px;background:#fff;color:#221D18;}
.knp-field input:focus{outline:none;border-color:#A14B2A;}
.knp-hint{font-size:.72rem;color:#a08d6c;margin-top:-6px;margin-bottom:12px;}
.knp-cta{appearance:none;border:none;width:100%;background:#A14B2A;color:#FBF7EE;
  font:inherit;font-size:.95rem;font-weight:600;padding:11px;border-radius:8px;
  cursor:pointer;letter-spacing:.02em;}
.knp-cta:hover{background:#8a3f23;}
.knp-cta:disabled{opacity:.5;cursor:default;}
.knp-alt{margin-top:14px;font-size:.85rem;text-align:center;color:#5a503f;}
.knp-link{background:none;border:none;color:#A14B2A;cursor:pointer;font:inherit;
  font-size:.85rem;text-decoration:underline;padding:0;}
.knp-msg{font-size:.85rem;padding:10px 12px;border-radius:8px;margin-bottom:12px;}
.knp-msg.err{background:#f7e3dd;color:#8a3f23;}
.knp-msg.ok{background:#e3efe0;color:#3a6a30;}
.knp-perfil-handle{font-size:1.1rem;font-weight:600;}
.knp-logout{appearance:none;border:1px solid #d8cdb4;background:transparent;color:#5a503f;
  font:inherit;font-size:.85rem;padding:8px 14px;border-radius:8px;cursor:pointer;margin-top:8px;}
.knp-logout:hover{border-color:#A14B2A;color:#A14B2A;}
`;
function injectCSS() {
  if (document.getElementById("knp-css")) return;
  const s = document.createElement("style");
  s.id = "knp-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ── Estado del panel ────────────────────────────────────────────────── */
let backdrop, panel, body, sessionCache = null, profileCache = null;

function build() {
  backdrop = document.createElement("div");
  backdrop.className = "knp-backdrop";
  backdrop.addEventListener("click", close);

  panel = document.createElement("aside");
  panel.className = "knp-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Mi perfil");
  panel.innerHTML = `
    <div class="knp-head">
      <h2>Mi cursus</h2>
      <button class="knp-x" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="knp-body"></div>`;
  panel.querySelector(".knp-x").addEventListener("click", close);
  // No cerrar al clicar dentro del panel.
  panel.addEventListener("click", (e) => e.stopPropagation());

  body = panel.querySelector(".knp-body");
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
}

function bloqueCursus() {
  const n = contarGestos();
  const g = cursus(n);
  return `<div class="knp-cursus">
      <div class="knp-grado">${g.nombre}<small>${g.sub}</small></div>
      <div class="knp-rastro">${n} ${n === 1 ? "gesto cívico" : "gestos cívicos"} registrados</div>
    </div>`;
}

function renderAnon(modo = "registro") {
  const esReg = modo === "registro";
  body.innerHTML = `
    ${bloqueCursus()}
    <p class="knp-lead">${esReg
      ? "Regístrate para conservar tu cursus y poder firmar, proponer y guardar."
      : "Entra para recuperar tu cuenta."}</p>
    <div class="knp-msg" style="display:none"></div>
    <form class="knp-form">
      <div class="knp-field">
        <label>Email</label>
        <input type="email" name="email" autocomplete="email" required />
      </div>
      <div class="knp-field">
        <label>Contraseña</label>
        <input type="password" name="password" autocomplete="${esReg ? "new-password" : "current-password"}" required minlength="6" />
      </div>
      ${esReg ? `
      <div class="knp-field">
        <label>Handle (tu nombre público)</label>
        <input type="text" name="handle" autocomplete="off" required />
      </div>
      <div class="knp-hint">minúsculas, números y _ · 3–30 caracteres</div>` : ``}
      <button class="knp-cta" type="submit">${esReg ? "Crear cuenta" : "Entrar"}</button>
    </form>
    <div class="knp-alt">
      ${esReg ? "¿Ya tienes cuenta? " : "¿Nuevo aquí? "}
      <button class="knp-link" type="button">${esReg ? "Entrar" : "Crear cuenta"}</button>
    </div>`;

  const form = body.querySelector(".knp-form");
  const msg = body.querySelector(".knp-msg");
  const showMsg = (txt, kind) => { msg.textContent = txt; msg.className = `knp-msg ${kind}`; msg.style.display = "block"; };

  body.querySelector(".knp-link").addEventListener("click", () => renderAnon(esReg ? "login" : "registro"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector(".knp-cta");
    const email = form.email.value.trim();
    const password = form.password.value;
    const handle = esReg ? form.handle.value.trim().toLowerCase() : null;

    if (esReg && !HANDLE_RE.test(handle)) {
      showMsg("Handle no válido: minúsculas, números y _ (3–30).", "err");
      return;
    }
    btn.disabled = true;
    btn.textContent = esReg ? "Creando…" : "Entrando…";
    try {
      if (esReg) {
        const { error } = await signUp({ email, password, handle });
        if (error) throw error;
        showMsg("Cuenta creada. Revisa tu email para confirmar y entra.", "ok");
        form.querySelector(".knp-cta").remove();
      } else {
        const { error } = await signIn({ email, password });
        if (error) throw error;
        await refresh();      // onAuthChange también dispara, pero refrescamos ya
        close();
      }
    } catch (err) {
      showMsg(err?.message || "No se pudo completar. Inténtalo de nuevo.", "err");
      btn.disabled = false;
      btn.textContent = esReg ? "Crear cuenta" : "Entrar";
    }
  });
}

function renderPerfil() {
  const n = contarGestos();
  const g = cursus(n);
  const handle = profileCache?.handle || sessionCache?.user?.email || "vecino/a";
  body.innerHTML = `
    <div class="knp-cursus">
      <div class="knp-grado">${g.nombre}<small>@${handle}</small></div>
      <div class="knp-rastro">${n} ${n === 1 ? "gesto cívico" : "gestos cívicos"}</div>
    </div>
    <p class="knp-lead">Tu sesión está activa. Tus gestos cuentan para tu cursus.</p>
    <button class="knp-logout" type="button">Cerrar sesión</button>`;
  body.querySelector(".knp-logout").addEventListener("click", async () => {
    await signOut();
    await refresh();
  });
}

function renderEstado() {
  if (sessionCache) renderPerfil();
  else renderAnon("registro");
}

/* ── Avatar FAB ──────────────────────────────────────────────────────── */
function avatar() { return document.getElementById("app-topbar-enter"); }
function pintarAvatar() {
  const a = avatar();
  if (!a) return;
  const reg = !!sessionCache;
  a.setAttribute("data-registered", reg ? "true" : "false");
  a.setAttribute("aria-label", reg ? "Mi perfil" : "Mi perfil — sin registrar");
  const badge = a.querySelector(".ava-badge");
  if (badge) {
    const handle = profileCache?.handle;
    badge.textContent = reg ? (handle ? handle[0].toUpperCase() : "✓") : "?";
  }
}

function open() { backdrop.classList.add("open"); panel.classList.add("open"); renderEstado(); }
function close() { backdrop.classList.remove("open"); panel.classList.remove("open"); }

async function refresh() {
  sessionCache = await getSession();
  profileCache = sessionCache ? await getProfile() : null;
  pintarAvatar();
}

/* ── Init (auto al importar) ─────────────────────────────────────────── */
let inited = false;
async function init() {
  if (inited) return;
  inited = true;
  injectCSS();
  build();
  const a = avatar();
  if (a) a.addEventListener("click", (e) => { e.preventDefault(); open(); });
  await refresh();
  onAuthChange(async (session) => {
    sessionCache = session;
    profileCache = session ? await getProfile() : null;
    pintarAvatar();
    if (panel.classList.contains("open")) renderEstado();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

export { init };
