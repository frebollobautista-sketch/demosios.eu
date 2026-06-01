// shared/navbar.js — Barra superior compartida entre las tres caras.
//
// Una sola identidad (mismo polis-uid, mismo log de gestos) — esto NO
// es cambiar de usuario, es cambiar de FACETA / algoritmo-yo activo:
//   🗺 Mapa (POLIS)  ·  🏛 Ágora  ·  📚 Biblioteca
//
// Cada destino lleva su acento (verde / ocre / índigo) para que el
// cambio de postura se note. La barra es fija arriba; mountNavbar()
// añade el padding-top necesario al body via la clase kn-has-navbar.
//
// POLIS usa su propio dropdown OCRE (no monta esta barra); Ágora y
// Biblioteca sí la montan. La navegación es por enlaces normales — la
// identidad persiste en localStorage porque es el mismo origen.

const DESTINOS = [
  { key: "mapa",       label: "Mapa",       icon: "🗺", href: "../polis-app/",      accent: "#6a9c5e" },
  { key: "agora",      label: "Ágora",      icon: "🏛", href: "../agora-app/",      accent: "#c9a86a" },
  { key: "biblioteca", label: "Biblioteca", icon: "📚", href: "../biblioteca-app/", accent: "#5a7ba8" }
];

export function mountNavbar(activeKey) {
  if (document.getElementById("kn-navbar")) return;
  const activo = DESTINOS.find(d => d.key === activeKey) || DESTINOS[0];

  const nav = document.createElement("nav");
  nav.id = "kn-navbar";
  nav.className = "kn-navbar";
  nav.setAttribute("aria-label", "Navegación entre Mapa, Ágora y Biblioteca");
  nav.style.setProperty("--kn-accent", activo.accent);

  nav.innerHTML = DESTINOS.map(d => `
    <a class="kn-tab${d.key === activeKey ? " is-active" : ""}"
       href="${d.href}" data-key="${d.key}"
       style="--kn-tab-accent:${d.accent}"
       ${d.key === activeKey ? 'aria-current="page"' : ""}>
      <span class="kn-ico" aria-hidden="true">${d.icon}</span>
      <span class="kn-lbl">${d.label}</span>
    </a>`).join("");

  document.body.insertBefore(nav, document.body.firstChild);
  document.body.classList.add("kn-has-navbar");
}

export const NAVBAR_DESTINOS = DESTINOS;
