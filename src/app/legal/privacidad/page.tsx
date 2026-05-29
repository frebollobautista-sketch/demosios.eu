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
  { id: "responsable", label: "1. Responsable del tratamiento" },
  { id: "datos", label: "2. Datos que recopilamos" },
  { id: "base-legal", label: "3. Base legal" },
  { id: "finalidad", label: "4. Finalidad del tratamiento" },
  { id: "proveedores", label: "5. Proveedores y encargados" },
  { id: "transferencias", label: "6. Transferencias internacionales" },
  { id: "conservacion", label: "7. Conservacion de datos" },
  { id: "derechos", label: "8. Derechos del usuario" },
  { id: "cookies", label: "9. Cookies" },
  { id: "seguridad", label: "10. Seguridad" },
  { id: "menores", label: "11. Menores" },
  { id: "modificaciones", label: "12. Modificaciones" },
  { id: "contacto", label: "13. Contacto" },
];

export default function PrivacidadPage() {
  return (
    <div>
      <h1 style={S.title}>Politica de Privacidad</h1>
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
      <section id="responsable" style={S.section}>
        <h2 style={S.h2}>1. Responsable del tratamiento</h2>
        <p style={S.p}>
          El responsable del tratamiento de tus datos personales es el equipo de
          KOINOS. Puedes contactarnos en cualquier momento a traves de:
        </p>
        <div style={S.callout}>
          <p style={{ ...S.p, fontWeight: 600, color: C.text }}>
            contacto@koinos.app
          </p>
        </div>
      </section>

      {/* 2 */}
      <section id="datos" style={S.section}>
        <h2 style={S.h2}>2. Datos que recopilamos</h2>

        <h3 style={S.h3}>Datos de perfil</h3>
        <ul style={S.ul}>
          <li>Nombre, handle, correo electronico, foto de perfil.</li>
          <li>Informacion biografica que decidas compartir.</li>
        </ul>

        <h3 style={S.h3}>Contenido</h3>
        <ul style={S.ul}>
          <li>Publicaciones, comentarios, PECs e interacciones.</li>
          <li>
            Entradas del diario personal (almacenadas localmente en
            localStorage; no se envian a nuestros servidores salvo que actives la
            sincronizacion).
          </li>
        </ul>

        <h3 style={S.h3}>Datos de interacciones</h3>
        <ul style={S.ul}>
          <li>
            Reacciones (PEC), seguimientos, encuestas y respuestas en Polis.
          </li>
        </ul>

        <h3 style={S.h3}>Datos tecnicos</h3>
        <ul style={S.ul}>
          <li>
            Direccion IP, tipo de navegador, sistema operativo, paginas
            visitadas, fechas y horas de acceso.
          </li>
          <li>Datos recopilados automaticamente a traves de cookies.</li>
        </ul>
      </section>

      {/* 3 */}
      <section id="base-legal" style={S.section}>
        <h2 style={S.h2}>3. Base legal del tratamiento</h2>
        <ul style={S.ul}>
          <li>
            <strong>Consentimiento</strong> (art. 6.1.a RGPD): al registrarte y
            aceptar estos terminos.
          </li>
          <li>
            <strong>Ejecucion contractual</strong> (art. 6.1.b RGPD): para
            prestarte el servicio que has solicitado.
          </li>
          <li>
            <strong>Interes legitimo</strong> (art. 6.1.f RGPD): para mejorar
            la Plataforma, prevenir fraude y garantizar la seguridad.
          </li>
        </ul>
      </section>

      {/* 4 */}
      <section id="finalidad" style={S.section}>
        <h2 style={S.h2}>4. Finalidad del tratamiento</h2>
        <ul style={S.ul}>
          <li>Gestionar tu cuenta y proporcionarte el servicio.</li>
          <li>Personalizar tu experiencia en la Plataforma.</li>
          <li>
            Enviarte comunicaciones relacionadas con el servicio (nunca
            publicidad de terceros).
          </li>
          <li>Garantizar la seguridad y moderar el contenido.</li>
          <li>
            Analizar el uso de la Plataforma para mejorarla (metricas
            agregadas).
          </li>
        </ul>
      </section>

      {/* 5 */}
      <section id="proveedores" style={S.section}>
        <h2 style={S.h2}>5. Proveedores y encargados del tratamiento</h2>
        <p style={S.p}>
          Utilizamos los siguientes proveedores para operar KOINOS:
        </p>
        <ul style={S.ul}>
          <li>
            <strong>Supabase</strong> — Base de datos, autenticacion y
            almacenamiento de archivos.
          </li>
          <li>
            <strong>Vercel</strong> — Hosting y despliegue de la aplicacion.
          </li>
          <li>
            <strong>Resend</strong> — Envio de correos electronicos
            transaccionales (verificacion, notificaciones).
          </li>
        </ul>
        <p style={S.p}>
          Todos los proveedores actuan como encargados del tratamiento y estan
          sujetos a contratos que garantizan la proteccion de tus datos conforme
          al RGPD.
        </p>
      </section>

      {/* 6 */}
      <section id="transferencias" style={S.section}>
        <h2 style={S.h2}>6. Transferencias internacionales</h2>
        <p style={S.p}>
          Algunos de nuestros proveedores (Supabase, Vercel) pueden procesar
          datos fuera del Espacio Economico Europeo (EEE). En esos casos, las
          transferencias se realizan al amparo de:
        </p>
        <ul style={S.ul}>
          <li>
            <strong>Clausulas contractuales tipo</strong> aprobadas por la
            Comision Europea.
          </li>
          <li>
            <strong>Decisiones de adecuacion</strong> de la Comision Europea,
            cuando existan.
          </li>
        </ul>
      </section>

      {/* 7 */}
      <section id="conservacion" style={S.section}>
        <h2 style={S.h2}>7. Conservacion de datos</h2>
        <p style={S.p}>
          Conservaremos tus datos mientras mantengas una cuenta activa en
          KOINOS. Si solicitas la eliminacion de tu cuenta, tus datos personales
          seran eliminados en un plazo maximo de 30 dias, salvo que la ley exija
          su conservacion durante un periodo mayor.
        </p>
        <p style={S.p}>
          Los datos anonimizados y agregados podran conservarse indefinidamente
          con fines estadisticos.
        </p>
      </section>

      {/* 8 */}
      <section id="derechos" style={S.section}>
        <h2 style={S.h2}>8. Derechos del usuario</h2>
        <p style={S.p}>
          Conforme al Reglamento General de Proteccion de Datos (RGPD), tienes
          derecho a:
        </p>
        <ul style={S.ul}>
          <li>
            <strong>Acceso</strong>: conocer que datos personales tratamos sobre
            ti.
          </li>
          <li>
            <strong>Rectificacion</strong>: corregir datos inexactos o
            incompletos.
          </li>
          <li>
            <strong>Supresion</strong>: solicitar la eliminacion de tus datos
            (&quot;derecho al olvido&quot;).
          </li>
          <li>
            <strong>Portabilidad</strong>: recibir tus datos en un formato
            estructurado y de uso comun.
          </li>
          <li>
            <strong>Oposicion</strong>: oponerte al tratamiento de tus datos en
            determinadas circunstancias.
          </li>
          <li>
            <strong>Limitacion</strong>: solicitar la restriccion del
            tratamiento.
          </li>
        </ul>
        <p style={S.p}>
          Para ejercer estos derechos, escribenos a{" "}
          <strong>contacto@koinos.app</strong>. Responderemos en un plazo maximo
          de 30 dias.
        </p>
        <p style={S.p}>
          Tambien tienes derecho a presentar una reclamacion ante la{" "}
          <strong>Agencia Espanola de Proteccion de Datos (AEPD)</strong> si
          consideras que tus derechos no han sido respetados.
        </p>
      </section>

      {/* 9 */}
      <section id="cookies" style={S.section}>
        <h2 style={S.h2}>9. Cookies</h2>
        <p style={S.p}>
          KOINOS utiliza cookies y tecnologias similares. Para obtener
          informacion detallada, consulta nuestra{" "}
          <a
            href="/legal/cookies"
            style={{ color: C.secondary, textDecoration: "none" }}
          >
            Politica de Cookies
          </a>
          .
        </p>
      </section>

      {/* 10 */}
      <section id="seguridad" style={S.section}>
        <h2 style={S.h2}>10. Seguridad</h2>
        <p style={S.p}>
          Implementamos medidas tecnicas y organizativas para proteger tus
          datos:
        </p>
        <ul style={S.ul}>
          <li>
            <strong>Cifrado en transito</strong>: todas las comunicaciones se
            realizan a traves de HTTPS.
          </li>
          <li>
            <strong>Row Level Security (RLS)</strong>: las politicas de seguridad
            a nivel de fila en Supabase garantizan que cada usuario solo acceda
            a sus propios datos.
          </li>
          <li>
            <strong>Autenticacion segura</strong>: gestionada por Supabase Auth
            con tokens cifrados.
          </li>
          <li>
            <strong>Acceso restringido</strong>: solo el personal autorizado
            tiene acceso a los sistemas de produccion.
          </li>
        </ul>
      </section>

      {/* 11 */}
      <section id="menores" style={S.section}>
        <h2 style={S.h2}>11. Menores</h2>
        <p style={S.p}>
          KOINOS no esta dirigido a menores de 16 anos. No recopilamos
          intencionadamente datos de menores de esta edad. Si detectamos que un
          menor se ha registrado, procederemos a eliminar su cuenta y datos
          asociados.
        </p>
      </section>

      {/* 12 */}
      <section id="modificaciones" style={S.section}>
        <h2 style={S.h2}>12. Modificaciones</h2>
        <p style={S.p}>
          Nos reservamos el derecho de actualizar esta politica. Los cambios
          significativos se comunicaran a traves de la Plataforma o por correo
          electronico. La fecha de &quot;ultima actualizacion&quot; al inicio de
          este documento siempre reflejara la version mas reciente.
        </p>
      </section>

      {/* 13 */}
      <section id="contacto" style={S.section}>
        <h2 style={S.h2}>13. Contacto</h2>
        <p style={S.p}>
          Para cualquier consulta sobre privacidad o proteccion de datos:
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
