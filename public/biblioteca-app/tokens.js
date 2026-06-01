// biblioteca-app/tokens.js — Tokens de invitación de la Biblioteca.
//
// Análogo al de agora-app pero los tokens se generan al **cerrar
// síntesis** (gesto "sintesis"), no al cerrar compromisos. Filosofía:
// en Biblioteca la "moneda" no es la acción cívica sino la integración
// crítica — sintetizar es lo que vale para invitar a alguien al espacio.
//
// Pre-Supabase: cuenta + historia local, sin validación remota. Los
// tokens se generan como URL local con hash para preservar contexto
// (qué síntesis los respalda).

import { recordGesto, getUserId, getAllGestos } from "../shared/gestos.js?v=20260527a";

const KEY_TOKENS = "biblioteca-tokens";

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

// Reconcilia el saldo: cuenta gestos "sintesis" válidos (al menos 2
// fuentes, 1 canónica + 1 crítica — eso lo valida loops.js, aquí sólo
// pedimos que el gesto exista del userId actual) y descuenta emitidos.
export function reconciliarTokens() {
  const estado = cargar();
  const uid = getUserId();
  const sintesis = getAllGestos().filter(g =>
    g.userId === uid && g.tipo === "sintesis" &&
    g.payload?.fuente_app === "biblioteca" && !g.falso
  ).length;
  const emitidos = estado.emitidos.length;
  const saldoEsperado = Math.max(0, sintesis - emitidos);
  if (saldoEsperado !== estado.saldo) {
    estado.saldo = saldoEsperado;
    guardar(estado);
  }
  return estado;
}

export function getTokensState() {
  return cargar();
}

// Llamar tras un gesto "sintesis" para registrar el ingreso en historia.
export function registrarSintesis(sintesis_ref) {
  const estado = cargar();
  estado.historia.push({
    accion: "ganado",
    ts: new Date().toISOString(),
    ref: sintesis_ref
  });
  guardar(estado);
  return reconciliarTokens();
}

export function emitirToken(hint) {
  let estado = reconciliarTokens();
  if (estado.saldo <= 0) return { ok: false, motivo: "sin_saldo" };

  const uid = getUserId();
  const sintesis = getAllGestos()
    .filter(g => g.userId === uid && g.tipo === "sintesis"
              && g.payload?.fuente_app === "biblioteca" && !g.falso)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  const yaUsadasRefs = new Set(estado.emitidos.map(e => e.basado_en_sintesis_ts));
  const sintesisLibre = sintesis.find(s => !yaUsadasRefs.has(s.ts));
  if (!sintesisLibre) return { ok: false, motivo: "sin_sintesis_libres" };

  const id = "tokb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  estado.emitidos.push({
    id,
    ts: new Date().toISOString(),
    basado_en_sintesis_ts: sintesisLibre.ts,
    titulo_sintesis: sintesisLibre.payload?.titulo || null,
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
        basado_en_sintesis_ts: sintesisLibre.ts,
        basado_en_titulo: sintesisLibre.payload?.titulo || null,
        hint: (hint || "").trim() || null,
        modo: "local"
      },
      saldo_restante: nuevo.saldo
    }
  };
}

export function tokenComoURL(token, baseUrl) {
  const base = baseUrl || (typeof location !== "undefined"
    ? location.origin + location.pathname
    : "/biblioteca-app/");
  const data = {
    id: token.id,
    h: token.payload.hint || undefined,
    t: token.payload.basado_en_titulo || undefined
  };
  const encoded = btoa(JSON.stringify(data)).replace(/=+$/, "");
  return `${base}#inv=${encoded}`;
}

export function renderTokensBlock(container) {
  if (!container) return;
  const estado = reconciliarTokens();
  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "tokens-head";
  head.innerHTML = `<strong>📖 Tokens</strong> <span class="tokens-saldo">${estado.saldo}</span>`;
  container.appendChild(head);

  const hint = document.createElement("p");
  hint.className = "tokens-hint";
  if (estado.saldo === 0) {
    hint.textContent = "Cada síntesis (G2) cerrada te da 1 token de invitación. Tu carta de presentación es lo que has sintetizado.";
  } else {
    hint.textContent = `Tienes ${estado.saldo} ${estado.saldo === 1 ? "invitación" : "invitaciones"}. Cada una llevará la síntesis que la respalda.`;
  }
  container.appendChild(hint);

  if (estado.saldo > 0) {
    const btn = document.createElement("button");
    btn.className = "btn-token-emit";
    btn.textContent = "emitir invitación";
    btn.addEventListener("click", () => {
      const h = prompt("Pista opcional (a quién, contexto):", "");
      if (h === null) return;
      const r = emitirToken(h);
      if (!r.ok) {
        alert("No se pudo emitir: " + r.motivo);
        return;
      }
      const url = tokenComoURL(r.token);
      navigator.clipboard?.writeText(url).catch(() => {});
      alert(`Invitación copiada.\n\nBasada en: ${r.token.payload.basado_en_titulo || "tu última síntesis"}\n${url}`);
      renderTokensBlock(container);
    });
    container.appendChild(btn);
  }

  if (estado.emitidos.length > 0) {
    const list = document.createElement("ul");
    list.className = "tokens-emitidos";
    estado.emitidos.slice(-3).reverse().forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.id.slice(0, 10)}… · ${e.destinatario_hint || (e.titulo_sintesis || "sin pista")}`;
      list.appendChild(li);
    });
    container.appendChild(list);
  }
}
