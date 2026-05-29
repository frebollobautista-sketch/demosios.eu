// agora-app/tokens.js — Sistema de tokens de invitación.
//
// Filosofía: el crecimiento es selectivo. Cada misión que cierras
// genera 1 token. Una invitación = un token quemado, atado al cierre
// que la respalda. La otra persona verá qué cerraste antes de entrar
// — esa es tu carta de presentación, no tu cara.
//
// Implementación localStorage primero (sin backend). Cuando llegue
// Supabase, los tokens se federarán: cada uno será un UUID + firma del
// emisor + referencia al gesto de cierre. Por ahora son contadores +
// historia local que ya se puede inspeccionar.

import { recordGesto, getUserId, getAllGestos } from "../shared/gestos.js?v=20260527a";

const KEY_TOKENS = "agora-tokens";

// Estado persistido:
//   { saldo: n,             // tokens disponibles para regalar
//     emitidos: [{ id, ts, basado_en_compromiso_ts, destinatario_hint? }],
//     historia: [{ accion: "ganado"|"emitido"|"consumido", ts, ref }] }
function cargar() {
  try {
    const raw = localStorage.getItem(KEY_TOKENS);
    if (!raw) return { saldo: 0, emitidos: [], historia: [] };
    const parsed = JSON.parse(raw);
    return {
      saldo: typeof parsed.saldo === "number" ? parsed.saldo : 0,
      emitidos: Array.isArray(parsed.emitidos) ? parsed.emitidos : [],
      historia: Array.isArray(parsed.historia) ? parsed.historia : []
    };
  } catch (e) { return { saldo: 0, emitidos: [], historia: [] }; }
}

function guardar(estado) {
  try { localStorage.setItem(KEY_TOKENS, JSON.stringify(estado)); }
  catch (e) {}
}

// Reconcilia el saldo con la realidad: cuenta los compromisos cumplidos
// del usuario actual y descuenta los tokens emitidos. Útil al arrancar
// la app para corregir desfases si el usuario manipuló el storage o si
// el log evolucionó por otro lado.
export function reconciliarTokens() {
  const estado = cargar();
  const uid = getUserId();
  const cierres = getAllGestos().filter(g =>
    g.userId === uid &&
    g.tipo === "compromiso_cumplido" &&
    g.payload?.fuente_app === "agora" &&
    !g.falso
  ).length;
  const emitidos = estado.emitidos.length;
  const saldoEsperado = Math.max(0, cierres - emitidos);
  if (saldoEsperado !== estado.saldo) {
    estado.saldo = saldoEsperado;
    guardar(estado);
  }
  return estado;
}

// Devuelve el estado actual (no muta).
export function getTokensState() {
  return cargar();
}

// Llamar tras un compromiso_cumplido para registrar el ingreso en la
// historia. El SALDO se calcula desde el log via reconciliarTokens()
// (es la fuente de verdad), pero la historia local guarda contexto
// legible para mostrar en UI.
export function registrarCierre(compromiso_ref) {
  const estado = cargar();
  estado.historia.push({
    accion: "ganado",
    ts: new Date().toISOString(),
    ref: compromiso_ref
  });
  guardar(estado);
  return reconciliarTokens();
}

// Emitir un token de invitación. Devuelve { ok, token? } o { ok: false, motivo }.
// Si no hay saldo, falla. Si hay, descuenta y produce un token con:
//   id: string corto compartible
//   payload: { emisor_uid, ts_emision, basado_en: ts_del_compromiso, hint? }
// Pre-Supabase: el token es solo un identificador local que el emisor
// puede compartir como URL; nadie lo valida todavía. Documentamos la
// limitación para que se vea claro en la UI ("modo local — sin
// validación remota aún").
export function emitirToken(hint) {
  let estado = reconciliarTokens();
  if (estado.saldo <= 0) return { ok: false, motivo: "sin_saldo" };

  // Buscar el compromiso_cumplido más reciente sin token emitido.
  const uid = getUserId();
  const cierres = getAllGestos()
    .filter(g => g.userId === uid && g.tipo === "compromiso_cumplido"
              && g.payload?.fuente_app === "agora" && !g.falso)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  const yaUsadasRefs = new Set(estado.emitidos.map(e => e.basado_en_compromiso_ts));
  const cierreLibre = cierres.find(c => !yaUsadasRefs.has(c.ts));
  if (!cierreLibre) return { ok: false, motivo: "sin_cierres_libres" };

  const id = "tok_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  estado.emitidos.push({
    id,
    ts: new Date().toISOString(),
    basado_en_compromiso_ts: cierreLibre.ts,
    destinatario_hint: (hint || "").trim() || null
  });
  estado.historia.push({
    accion: "emitido",
    ts: new Date().toISOString(),
    ref: id
  });
  guardar(estado);
  const nuevo = reconciliarTokens();

  return {
    ok: true,
    token: {
      id,
      payload: {
        emisor_uid: uid,
        ts_emision: estado.emitidos[estado.emitidos.length - 1].ts,
        basado_en_compromiso_ts: cierreLibre.ts,
        basado_en_titulo: cierreLibre.payload?.titulo || null,
        hint: (hint || "").trim() || null,
        modo: "local"   // pre-Supabase
      },
      saldo_restante: nuevo.saldo
    }
  };
}

// Helper para generar una URL de invitación. Pre-backend es solo un
// link a la propia app con un query param ?invitacion=<token-id>;
// app.js puede leerlo y mostrar "alguien te invitó por haber cerrado X".
export function tokenComoURL(token, baseUrl) {
  const base = baseUrl || (typeof location !== "undefined" ? location.origin + location.pathname : "/agora-app/");
  // Codificamos id + hint corto en el hash para no necesitar backend.
  const data = {
    id: token.id,
    h: token.payload.hint || undefined,
    t: token.payload.basado_en_titulo || undefined
  };
  const encoded = btoa(JSON.stringify(data)).replace(/=+$/, "");
  return `${base}#inv=${encoded}`;
}

// Render compacto del bloque tokens en el drawer.
export function renderTokensBlock(container) {
  if (!container) return;
  const estado = reconciliarTokens();
  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "tokens-head";
  head.innerHTML = `<strong>🎟 Tokens</strong> <span class="tokens-saldo">${estado.saldo}</span>`;
  container.appendChild(head);

  const hint = document.createElement("p");
  hint.className = "tokens-hint";
  if (estado.saldo === 0) {
    hint.textContent = "Cada misión cerrada te da 1 token de invitación.";
  } else {
    hint.textContent = `Tienes ${estado.saldo} ${estado.saldo === 1 ? "invitación" : "invitaciones"} disponibles.`;
  }
  container.appendChild(hint);

  if (estado.saldo > 0) {
    const btn = document.createElement("button");
    btn.className = "btn-token-emit";
    btn.textContent = "emitir invitación";
    btn.addEventListener("click", () => {
      const h = prompt("Pista opcional (a quién, contexto). Vacío vale:", "");
      if (h === null) return;
      const r = emitirToken(h);
      if (!r.ok) {
        alert("No se pudo emitir: " + r.motivo);
        return;
      }
      const url = tokenComoURL(r.token);
      navigator.clipboard?.writeText(url).catch(() => {});
      const msg = `Invitación copiada al portapapeles.\n\nBasada en: ${r.token.payload.basado_en_titulo || "tu último cierre"}\n${url}`;
      alert(msg);
      renderTokensBlock(container);  // refrescar saldo
    });
    container.appendChild(btn);
  }

  if (estado.emitidos.length > 0) {
    const list = document.createElement("ul");
    list.className = "tokens-emitidos";
    estado.emitidos.slice(-3).reverse().forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.id.slice(0, 10)}… · ${e.destinatario_hint || "sin pista"}`;
      list.appendChild(li);
    });
    container.appendChild(list);
  }
}
