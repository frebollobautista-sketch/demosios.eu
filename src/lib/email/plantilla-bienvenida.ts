/**
 * Plantilla HTML — Email de bienvenida
 *
 * Se envía cuando un usuario confirma su cuenta por primera vez.
 * Tono mixto: arranca con reflexión personal de Pancho,
 * cierra con info práctica sobre la plataforma.
 *
 * Variables:
 *  - {{ nombre }}  → handle o nombre del usuario (fallback: "ciudadano/a")
 */

export function plantillaBienvenida(nombre?: string) {
  const displayName = nombre || "ciudadano/a";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bienvenida a OCRE</title>
  <style>
    /* Reset */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; }
    img { border: 0; outline: none; text-decoration: none; }

    /* Tokens OCRE */
    :root {
      --papiro: #FFFFFF;
      --papiro-soft: #F5F2EA;
      --papiro-ink: #1A1714;
      --ocre: #B4832E;
      --ocre-deep: #8A5E1F;
      --siena: #A14B2A;
      --piedra: #6D6458;
      --piedra-clara: #9C9283;
      --linea: #E5E1D6;
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F5F2EA; font-family: 'Palatino Linotype', Palatino, Georgia, serif;">

  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EA;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FFFFFF; border-radius:12px; box-shadow: 0 6px 24px -8px rgba(28,25,21,0.14);">

          <!-- Header band -->
          <tr>
            <td style="background-color:#8A5E1F; padding: 28px 32px; border-radius:12px 12px 0 0;">
              <p style="margin:0; font-size:13px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.7); font-family: system-ui, -apple-system, sans-serif;">
                OCRE
              </p>
              <h1 style="margin:8px 0 0; font-size:22px; font-weight:600; color:#FFFFFF; line-height:1.3;">
                Bienvenido/a, ${displayName}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">

              <!-- Reflexión personal -->
              <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#1A1714;">
                Te escribo porque acabas de dar un paso que poca gente da: decidir que la política puede ser otra cosa.
              </p>
              <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#1A1714;">
                No otra cosa mejor ni peor — simplemente más cercana, más jugable, más tuya. Esa es la idea detrás de OCRE: que participar en lo público se sienta como avanzar, no como gritar al vacío.
              </p>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.7; color:#1A1714;">
                Estamos empezando y todo está por construir. Pero precisamente por eso cada persona que se suma importa. Gracias por estar aquí.
              </p>

              <!-- Firma -->
              <p style="margin:0 0 28px; font-size:15px; color:#6D6458; font-style:italic;">
                — Pancho
              </p>

              <!-- Divisor -->
              <hr style="border:none; border-top:1px solid #E5E1D6; margin:0 0 24px;" />

              <!-- Info práctica -->
              <p style="margin:0 0 6px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9C9283; font-family: system-ui, -apple-system, sans-serif; font-weight:600;">
                Qué puedes hacer ahora
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                <tr>
                  <td style="padding:12px 16px; background-color:#F5F2EA; border-radius:8px; margin-bottom:8px;">
                    <p style="margin:0; font-size:14px; font-weight:600; color:#8A5E1F;">Ágora</p>
                    <p style="margin:4px 0 0; font-size:13px; color:#6D6458; line-height:1.5;">
                      Participa en debates y propuestas vecinales. Tu voz cuenta.
                    </p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px; background-color:#F5F2EA; border-radius:8px;">
                    <p style="margin:0; font-size:14px; font-weight:600; color:#8A5E1F;">Bibliotheka</p>
                    <p style="margin:4px 0 0; font-size:13px; color:#6D6458; line-height:1.5;">
                      Explora datos abiertos y recursos públicos de tu territorio.
                    </p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px; background-color:#F5F2EA; border-radius:8px;">
                    <p style="margin:0; font-size:14px; font-weight:600; color:#8A5E1F;">Polis</p>
                    <p style="margin:4px 0 0; font-size:13px; color:#6D6458; line-height:1.5;">
                      Navega tu ciudad en 3D. Visualiza lo público desde el mapa.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="https://demosios.eu"
                       style="display:inline-block; padding:14px 36px; background-color:#A14B2A; color:#FFFFFF; text-decoration:none; border-radius:8px; font-size:15px; font-weight:600; font-family: system-ui, -apple-system, sans-serif;">
                      Entrar a la plataforma
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 28px; border-top:1px solid #E5E1D6;">
              <p style="margin:0; font-size:12px; color:#9C9283; line-height:1.5; text-align:center; font-family: system-ui, -apple-system, sans-serif;">
                OCRE — Organización Canaria para la Recuperación de Espacios<br />
                Este correo se envía una sola vez, al confirmar tu cuenta.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>`;
}
