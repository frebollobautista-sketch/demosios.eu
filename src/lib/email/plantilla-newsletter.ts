/**
 * Plantilla HTML — Newsletter periódica de OCRE
 *
 * Tono mixto: reflexión personal de Pancho + novedades estructuradas.
 * Pensada para envío recurrente (semanal o mensual).
 *
 * Variables:
 *  - numero:      número de la edición (ej. "01")
 *  - fecha:       fecha legible (ej. "Mayo 2026")
 *  - asunto:      asunto / titular de la edición
 *  - reflexion:   párrafos HTML de la reflexión personal
 *  - novedades:   array de { titulo, texto } con las novedades
 *  - cierre:      frase de cierre opcional
 */

interface Novedad {
  titulo: string;
  texto: string;
}

interface NewsletterParams {
  numero: string;
  fecha: string;
  asunto: string;
  reflexion: string;
  novedades: Novedad[];
  cierre?: string;
}

export function plantillaNewsletter({
  numero,
  fecha,
  asunto,
  reflexion,
  novedades,
  cierre,
}: NewsletterParams) {
  const novedadesHtml = novedades
    .map(
      (n) => `
        <tr>
          <td style="padding:14px 16px; background-color:#F5F2EA; border-radius:8px;">
            <p style="margin:0; font-size:14px; font-weight:600; color:#8A5E1F;">${n.titulo}</p>
            <p style="margin:6px 0 0; font-size:13.5px; color:#6D6458; line-height:1.6;">${n.texto}</p>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OCRE — Carta #${numero}</title>
</head>
<body style="margin:0; padding:0; background-color:#F5F2EA; font-family: 'Palatino Linotype', Palatino, Georgia, serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EA;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FFFFFF; border-radius:12px; box-shadow: 0 6px 24px -8px rgba(28,25,21,0.14);">

          <!-- Header -->
          <tr>
            <td style="background-color:#8A5E1F; padding: 24px 32px; border-radius:12px 12px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.6); font-family: system-ui, -apple-system, sans-serif;">
                      Carta de OCRE · #${numero}
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0; font-size:12px; color:rgba(255,255,255,0.6); font-family: system-ui, -apple-system, sans-serif;">
                      ${fecha}
                    </p>
                  </td>
                </tr>
              </table>
              <h1 style="margin:10px 0 0; font-size:21px; font-weight:600; color:#FFFFFF; line-height:1.35;">
                ${asunto}
              </h1>
            </td>
          </tr>

          <!-- Reflexión personal -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <div style="font-size:15px; line-height:1.75; color:#1A1714;">
                ${reflexion}
              </div>
              <p style="margin:20px 0 0; font-size:15px; color:#6D6458; font-style:italic;">
                — Pancho
              </p>
            </td>
          </tr>

          <!-- Divisor -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border:none; border-top:1px solid #E5E1D6; margin:0;" />
            </td>
          </tr>

          <!-- Novedades -->
          <tr>
            <td style="padding: 24px 32px;">
              <p style="margin:0 0 14px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9C9283; font-family: system-ui, -apple-system, sans-serif; font-weight:600;">
                Novedades del proyecto
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${novedadesHtml}
              </table>
            </td>
          </tr>

          ${
            cierre
              ? `
          <!-- Cierre -->
          <tr>
            <td style="padding: 0 32px 28px;">
              <p style="margin:0; font-size:14px; line-height:1.65; color:#6D6458; font-style:italic;">
                ${cierre}
              </p>
            </td>
          </tr>`
              : ""
          }

          <!-- CTA -->
          <tr>
            <td align="center" style="padding: 0 32px 32px;">
              <a href="https://demosios.eu"
                 style="display:inline-block; padding:13px 32px; background-color:#A14B2A; color:#FFFFFF; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; font-family: system-ui, -apple-system, sans-serif;">
                Ir a la plataforma
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px; border-top:1px solid #E5E1D6;">
              <p style="margin:0; font-size:12px; color:#9C9283; line-height:1.5; text-align:center; font-family: system-ui, -apple-system, sans-serif;">
                OCRE — Organización Canaria para la Recuperación de Espacios<br />
                <a href="https://demosios.eu/ajustes" style="color:#9C9283;">Gestionar preferencias de correo</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
