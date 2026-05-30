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
};

const sections = [
  { id: "aceptacion", label: "1. Aceptacion de los terminos" },
  { id: "descripcion", label: "2. Descripcion del servicio" },
  { id: "registro", label: "3. Registro y cuenta" },
  { id: "contenido", label: "4. Contenido del usuario" },
  { id: "conducta", label: "5. Conducta prohibida" },
  { id: "ia", label: "6. Contenido generado por IA" },
  { id: "moderacion", label: "7. Sistema de moderacion" },
  { id: "pec", label: "8. PEC e interacciones" },
  { id: "propiedad", label: "9. Propiedad intelectual" },
  { id: "limitacion", label: "10. Limitacion de responsabilidad" },
  { id: "modificaciones", label: "11. Modificaciones" },
  { id: "ley", label: "12. Ley aplicable" },
  { id: "contacto", label: "13. Contacto" },
];

export default function TerminosPage() {
  return (
    <div>
      <h1 style={S.title}>Terminos de Servicio</h1>
      <p style={S.updated}>Ultima actualizacion: 13 de abril de 2026</p>

      {/* Table of contents */}
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
      <section id="aceptacion" style={S.section}>
        <h2 style={S.h2}>1. Aceptacion de los terminos</h2>
        <p style={S.p}>
          Al acceder o utilizar KOINOS (&quot;la Plataforma&quot;), aceptas
          quedar vinculado por estos Terminos de Servicio. Si no estas de
          acuerdo con alguna parte de estos terminos, no podras utilizar la
          Plataforma.
        </p>
        <p style={S.p}>
          El uso continuado de KOINOS tras la publicacion de cambios en estos
          terminos constituye la aceptacion de dichos cambios.
        </p>
      </section>

      {/* 2 */}
      <section id="descripcion" style={S.section}>
        <h2 style={S.h2}>2. Descripcion del servicio</h2>
        <p style={S.p}>
          KOINOS es una red social que ofrece tres modos de interaccion:
        </p>
        <ul style={S.ul}>
          <li>
            <strong>TOUCH</strong> — Espacio personal: diario privado,
            calibrador emocional y herramientas de autoconocimiento.
          </li>
          <li>
            <strong>FEED</strong> — Red social: publicaciones, PECs (reacciones
            publicas), comentarios y conexiones con otros usuarios.
          </li>
          <li>
            <strong>POLIS</strong> — Espacio civico: encuestas, debates y
            participacion en la comunidad.
          </li>
        </ul>
        <p style={S.p}>
          La Plataforma puede incluir funciones experimentales que se anaden o
          retiran sin previo aviso.
        </p>
      </section>

      {/* 3 */}
      <section id="registro" style={S.section}>
        <h2 style={S.h2}>3. Registro y cuenta</h2>
        <ul style={S.ul}>
          <li>
            Debes tener al menos <strong>16 anos</strong> para crear una cuenta.
          </li>
          <li>
            Cada usuario elige un <strong>handle unico</strong> que lo
            identifica en la Plataforma.
          </li>
          <li>
            Los datos proporcionados durante el registro deben ser{" "}
            <strong>veraces y actualizados</strong>.
          </li>
          <li>
            Eres responsable de mantener la seguridad de tu cuenta y contrasena.
          </li>
          <li>
            Nos reservamos el derecho de suspender o eliminar cuentas que
            infrinjan estos terminos.
          </li>
        </ul>
      </section>

      {/* 4 */}
      <section id="contenido" style={S.section}>
        <h2 style={S.h2}>4. Contenido del usuario</h2>
        <p style={S.p}>
          Eres el unico responsable del contenido que publicas en KOINOS,
          incluyendo textos, imagenes, videos y cualquier otro material.
        </p>
        <p style={S.p}>
          Al publicar contenido, otorgas a KOINOS una licencia{" "}
          <strong>
            no exclusiva, mundial, libre de regalias y transferible
          </strong>{" "}
          para mostrar, distribuir y reproducir dicho contenido dentro de la
          Plataforma, con el unico proposito de operar y mejorar el servicio.
        </p>
        <p style={S.p}>
          Conservas todos los derechos de propiedad sobre tu contenido. Puedes
          eliminar tu contenido en cualquier momento, lo que revocara la
          licencia mencionada (salvo copias razonables de respaldo).
        </p>
      </section>

      {/* 5 */}
      <section id="conducta" style={S.section}>
        <h2 style={S.h2}>5. Conducta prohibida</h2>
        <p style={S.p}>No esta permitido:</p>
        <ul style={S.ul}>
          <li>
            Publicar contenido de <strong>odio, acoso o discriminacion</strong>{" "}
            por razon de raza, genero, orientacion sexual, religion,
            discapacidad u origen.
          </li>
          <li>
            Realizar <strong>spam</strong>, publicidad no autorizada o
            manipulacion de metricas.
          </li>
          <li>
            <strong>Suplantar la identidad</strong> de otras personas o
            entidades.
          </li>
          <li>
            Publicar <strong>contenido ilegal</strong> o que infrinja derechos
            de terceros.
          </li>
          <li>
            Intentar acceder a cuentas ajenas o vulnerar la seguridad de la
            Plataforma.
          </li>
          <li>
            Utilizar bots o scripts automatizados sin autorizacion expresa.
          </li>
        </ul>
      </section>

      {/* 6 */}
      <section id="ia" style={S.section}>
        <h2 style={S.h2}>6. Contenido generado por IA</h2>
        <div style={S.callout}>
          <p style={S.p}>
            KOINOS incluye una funcion llamada <strong>Yapper</strong> que
            genera personajes historicos simulados mediante inteligencia
            artificial. Estos personajes estan{" "}
            <strong>claramente etiquetados</strong> como IA y no representan las
            opiniones reales de las figuras historicas que simulan.
          </p>
        </div>
        <p style={S.p}>
          El contenido generado por IA es orientativo y de entretenimiento. No
          debe interpretarse como consejo profesional, historico riguroso ni
          opinion editorial de KOINOS.
        </p>
        <p style={S.p}>
          Nos reservamos el derecho de modificar, limitar o eliminar las
          funciones de IA en cualquier momento.
        </p>
      </section>

      {/* 7 */}
      <section id="moderacion" style={S.section}>
        <h2 style={S.h2}>7. Sistema de moderacion</h2>
        <p style={S.p}>
          KOINOS implementa un sistema de moderacion que puede incluir:
        </p>
        <ul style={S.ul}>
          <li>
            <strong>Reportes de la comunidad</strong>: cualquier usuario puede
            reportar contenido o cuentas que infrinjan estos terminos.
          </li>
          <li>
            <strong>Shadow ban</strong>: reduccion de la visibilidad de
            contenido o cuentas que incumplan las normas, sin notificacion
            previa.
          </li>
          <li>
            <strong>Eliminacion de contenido</strong>: retirada de
            publicaciones que violen estos terminos.
          </li>
          <li>
            <strong>Suspension o eliminacion de cuentas</strong> en casos
            graves o reincidentes.
          </li>
        </ul>
        <p style={S.p}>
          Las decisiones de moderacion se toman a nuestro exclusivo criterio y
          no generan derecho a indemnizacion.
        </p>
      </section>

      {/* 8 */}
      <section id="pec" style={S.section}>
        <h2 style={S.h2}>8. PEC e interacciones</h2>
        <p style={S.p}>
          Al realizar un <strong>PEC</strong> (reaccion publica) sobre una
          publicacion, tu avatar y tu handle aparecen publicamente asociados a
          dicha interaccion. Esto es visible para el autor de la publicacion y,
          dependiendo de la configuracion de privacidad, para otros usuarios.
        </p>
        <p style={S.p}>
          Al usar PEC, aceptas que tu interaccion sea publica dentro de la
          Plataforma.
        </p>
      </section>

      {/* 9 */}
      <section id="propiedad" style={S.section}>
        <h2 style={S.h2}>9. Propiedad intelectual</h2>
        <p style={S.p}>
          KOINOS, su diseno, logotipo, codigo fuente, funcionalidades y marca
          son propiedad de sus creadores y estan protegidos por las leyes de
          propiedad intelectual aplicables.
        </p>
        <p style={S.p}>
          No se concede al usuario ninguna licencia sobre la propiedad
          intelectual de KOINOS, salvo el derecho limitado a usar la Plataforma
          conforme a estos terminos.
        </p>
      </section>

      {/* 10 */}
      <section id="limitacion" style={S.section}>
        <h2 style={S.h2}>10. Limitacion de responsabilidad</h2>
        <p style={S.p}>
          KOINOS se ofrece &quot;tal cual&quot; y &quot;segun
          disponibilidad&quot;. No garantizamos que el servicio sea
          ininterrumpido, seguro o libre de errores.
        </p>
        <p style={S.p}>
          En la maxima medida permitida por la ley, KOINOS no sera responsable
          de danos indirectos, incidentales, especiales o consecuentes derivados
          del uso o la imposibilidad de uso de la Plataforma.
        </p>
      </section>

      {/* 11 */}
      <section id="modificaciones" style={S.section}>
        <h2 style={S.h2}>11. Modificaciones a los terminos</h2>
        <p style={S.p}>
          Nos reservamos el derecho de modificar estos terminos en cualquier
          momento. Los cambios significativos se comunicaran mediante un aviso
          visible en la Plataforma o por correo electronico.
        </p>
        <p style={S.p}>
          El uso continuado del servicio tras la notificacion de cambios
          constituye la aceptacion de los nuevos terminos.
        </p>
      </section>

      {/* 12 */}
      <section id="ley" style={S.section}>
        <h2 style={S.h2}>12. Ley aplicable</h2>
        <p style={S.p}>
          Estos terminos se rigen por la legislacion del Reino de Espana.
          Cualquier controversia sera sometida a los juzgados y tribunales
          competentes del domicilio del usuario, salvo que la ley disponga otra
          cosa.
        </p>
      </section>

      {/* 13 */}
      <section id="contacto" style={S.section}>
        <h2 style={S.h2}>13. Contacto</h2>
        <p style={S.p}>
          Para cualquier consulta relacionada con estos terminos, puedes
          escribirnos a:
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
