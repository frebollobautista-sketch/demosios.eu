"use client";

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

const S = {
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: C.text,
    letterSpacing: "-0.02em",
    marginBottom: 8,
    lineHeight: 1.2,
  } as React.CSSProperties,
  updated: {
    fontSize: 13,
    color: C.textDim,
    marginBottom: 32,
  } as React.CSSProperties,
  tocLink: {
    display: "block",
    fontSize: 14,
    color: C.secondary,
    textDecoration: "none",
    padding: "4px 0",
    lineHeight: 1.5,
  } as React.CSSProperties,
  section: {
    marginBottom: 32,
  } as React.CSSProperties,
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
    marginBottom: 12,
    lineHeight: 1.3,
  } as React.CSSProperties,
  h3: {
    fontSize: 16,
    fontWeight: 600,
    color: C.text,
    marginBottom: 8,
    lineHeight: 1.4,
  } as React.CSSProperties,
  p: {
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 1.7,
    marginBottom: 12,
  } as React.CSSProperties,
  ul: {
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 1.7,
    paddingLeft: 20,
    marginBottom: 12,
  } as React.CSSProperties,
  callout: {
    borderLeft: `3px solid ${C.secondary}`,
    paddingLeft: 16,
    marginBottom: 12,
  } as React.CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
    marginBottom: 16,
  },
  th: {
    textAlign: "left" as const,
    padding: "10px 12px",
    background: C.surfaceAlt,
    color: C.text,
    fontWeight: 600,
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
  },
  td: {
    padding: "10px 12px",
    color: C.textMuted,
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
    lineHeight: 1.5,
    verticalAlign: "top" as const,
  },
};

const sections = [
  { id: "que-son", label: "1. Que son las cookies" },
  { id: "cookies-utilizamos", label: "2. Cookies que utilizamos" },
  { id: "localstorage", label: "3. localStorage" },
  { id: "terceros", label: "4. Cookies de terceros" },
  { id: "gestionar", label: "5. Como gestionar cookies" },
  { id: "cambios", label: "6. Cambios en esta politica" },
  { id: "contacto", label: "7. Contacto" },
];

export default function CookiesPage() {
  return (
    <div>
      <h1 style={S.title}>Politica de Cookies</h1>
      <p style={S.updated}>Ultima actualizacion: 13 de abril de 2026</p>

      <nav
        style={{
          background: C.surfaceAlt,
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 36,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Indice
        </p>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} style={S.tocLink}>
            {s.label}
          </a>
        ))}
      </nav>

      {/* 1 */}
      <section id="que-son" style={S.section}>
        <h2 style={S.h2}>1. Que son las cookies</h2>
        <p style={S.p}>
          Las cookies son pequenos archivos de texto que los sitios web
          almacenan en tu navegador. Se utilizan para recordar preferencias,
          mantener sesiones activas y mejorar la experiencia del usuario.
        </p>
        <p style={S.p}>
          Ademas de las cookies tradicionales, KOINOS utiliza{" "}
          <strong>localStorage</strong>, un mecanismo de almacenamiento local
          del navegador que permite guardar datos de forma persistente en tu
          dispositivo.
        </p>
      </section>

      {/* 2 */}
      <section id="cookies-utilizamos" style={S.section}>
        <h2 style={S.h2}>2. Cookies que utilizamos</h2>

        <h3 style={S.h3}>Cookies esenciales</h3>
        <p style={S.p}>
          Son necesarias para el funcionamiento basico de la Plataforma. Sin
          ellas, no podrias iniciar sesion ni usar KOINOS.
        </p>
        <div style={{ overflowX: "auto", marginBottom: 20 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Cookie</th>
                <th style={S.th}>Proveedor</th>
                <th style={S.th}>Finalidad</th>
                <th style={S.th}>Duracion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>
                  <code>sb-*-auth-token</code>
                </td>
                <td style={S.td}>Supabase</td>
                <td style={S.td}>
                  Mantener la sesion del usuario autenticado.
                </td>
                <td style={S.td}>Sesion / 1 ano</td>
              </tr>
              <tr>
                <td style={S.td}>
                  <code>sb-*-auth-token-code-verifier</code>
                </td>
                <td style={S.td}>Supabase</td>
                <td style={S.td}>
                  Verificacion PKCE durante el flujo de autenticacion.
                </td>
                <td style={S.td}>Sesion</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style={S.h3}>Cookies funcionales</h3>
        <p style={S.p}>
          Permiten recordar tus preferencias para ofrecerte una experiencia
          personalizada.
        </p>
        <div style={{ overflowX: "auto", marginBottom: 20 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Cookie / Clave</th>
                <th style={S.th}>Finalidad</th>
                <th style={S.th}>Duracion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>
                  <code>yapperOn</code>
                </td>
                <td style={S.td}>
                  Recordar si el usuario ha activado los personajes Yapper (IA).
                </td>
                <td style={S.td}>Persistente</td>
              </tr>
              <tr>
                <td style={S.td}>
                  <code>theme</code>
                </td>
                <td style={S.td}>Preferencia de tema visual.</td>
                <td style={S.td}>Persistente</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3 */}
      <section id="localstorage" style={S.section}>
        <h2 style={S.h2}>3. Almacenamiento local (localStorage)</h2>
        <p style={S.p}>
          KOINOS utiliza localStorage para guardar datos directamente en tu
          navegador. Estos datos <strong>no se envian a nuestros servidores</strong>{" "}
          y permanecen unicamente en tu dispositivo.
        </p>
        <div style={{ overflowX: "auto", marginBottom: 20 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Clave</th>
                <th style={S.th}>Finalidad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>
                  <code>KOINOS:diary:*</code>
                </td>
                <td style={S.td}>
                  Entradas del diario personal. Se almacenan localmente para
                  maxima privacidad.
                </td>
              </tr>
              <tr>
                <td style={S.td}>
                  <code>onboarding_seen</code>
                </td>
                <td style={S.td}>
                  Indica si el usuario ha completado el proceso de onboarding.
                </td>
              </tr>
              <tr>
                <td style={S.td}>
                  <code>calibrador_*</code>
                </td>
                <td style={S.td}>
                  Datos del calibrador emocional (modo TOUCH).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 */}
      <section id="terceros" style={S.section}>
        <h2 style={S.h2}>4. Cookies de terceros</h2>
        <div style={S.callout}>
          <p style={S.p}>
            <strong>Actualmente, KOINOS no utiliza cookies de terceros.</strong>{" "}
            No incluimos herramientas de analitica de terceros, redes
            publicitarias ni trackers externos. Si esto cambiara en el futuro,
            actualizaremos esta politica e informaremos a los usuarios.
          </p>
        </div>
      </section>

      {/* 5 */}
      <section id="gestionar" style={S.section}>
        <h2 style={S.h2}>5. Como gestionar cookies</h2>
        <p style={S.p}>
          Puedes configurar tu navegador para bloquear o eliminar cookies. Ten
          en cuenta que si desactivas las cookies esenciales, no podras iniciar
          sesion en KOINOS.
        </p>

        <h3 style={S.h3}>Google Chrome</h3>
        <p style={S.p}>
          Ajustes &gt; Privacidad y seguridad &gt; Cookies y otros datos de
          sitios. Desde ahi puedes ver, bloquear o eliminar cookies.
        </p>

        <h3 style={S.h3}>Safari</h3>
        <p style={S.p}>
          Preferencias &gt; Privacidad &gt; Gestionar datos de sitios web.
          Puedes eliminar cookies de sitios especificos o bloquear todas las
          cookies.
        </p>

        <h3 style={S.h3}>Mozilla Firefox</h3>
        <p style={S.p}>
          Ajustes &gt; Privacidad y seguridad &gt; Cookies y datos del sitio.
          Puedes gestionar excepciones y limpiar datos.
        </p>

        <h3 style={S.h3}>localStorage</h3>
        <p style={S.p}>
          Para eliminar datos de localStorage, puedes usar las herramientas de
          desarrollo de tu navegador (F12 &gt; Application &gt; Local Storage) o
          borrar todos los datos del sitio desde la configuracion de privacidad.
        </p>
      </section>

      {/* 6 */}
      <section id="cambios" style={S.section}>
        <h2 style={S.h2}>6. Cambios en esta politica</h2>
        <p style={S.p}>
          Si modificamos las cookies que utilizamos o anadimos nuevas
          categorias, actualizaremos esta pagina y, en caso de cambios
          significativos, te informaremos a traves de la Plataforma.
        </p>
      </section>

      {/* 7 */}
      <section id="contacto" style={S.section}>
        <h2 style={S.h2}>7. Contacto</h2>
        <p style={S.p}>
          Si tienes preguntas sobre nuestra politica de cookies:
        </p>
        <div style={S.callout}>
          <p style={{ ...S.p, fontWeight: 600, color: C.text }}>
            contacto@koinos.app
          </p>
        </div>
      </section>
    </div>
  );
}
