# Setup de Supabase — guía paso a paso

Esta guía te lleva desde un proyecto Supabase recién creado hasta tener
toda la infraestructura de la web funcionando: tablas, políticas de
seguridad, magic links operativos y login con Google.

**Tiempo estimado**: 60–90 minutos la primera vez.

**Pre-requisitos**:
- Cuenta en Supabase con el proyecto `ocre` ya creado (URL:
  `https://zkezbitcvpjyxyyjilyx.supabase.co`).
- Acceso al dashboard como Owner u Admin.
- Cuenta en [Resend](https://resend.com) (gratis hasta 3.000 emails/mes
  y dominio verificable).
- Cuenta en Google Cloud Console (para Google OAuth — opcional).

---

## A. Aplicar las 7 migraciones SQL

Las migraciones crean las tablas, índices, políticas RLS y datos
semilla del proyecto. Sin esto, ninguna tabla existe en la base de
datos.

**Orden importa**: aplícalas una por una, en orden cronológico (el
nombre del archivo lleva timestamp).

1. Abre el dashboard del proyecto Supabase.
2. Menú lateral izquierdo → **SQL Editor**.
3. Para cada archivo de la carpeta `supabase/migrations/`, en este
   orden exacto:

   | # | Archivo | Qué hace |
   |---|---|---|
   | 1 | `20260413000000_initial_schema.sql` | Crea profiles, posts, comments, álbumes, votos, reports y los tipos enum |
   | 2 | `20260413000001_rls_policies.sql` | Políticas Row Level Security (quién puede leer/escribir qué) |
   | 3 | `20260413000002_indexes.sql` | Índices para queries rápidas |
   | 4 | `20260413000003_seed_citas.sql` | Datos semilla: citas históricas para Lógos |
   | 5 | `20260502000000_agora.sql` | Tablas Ágora: hilos, respuestas, secciones |
   | 6 | `20260503000000_logos.sql` | Sub-módulo Lógos (texto/cita/audio + PEC) |
   | 7 | `20260506130000_consultorias.sql` | Solicitudes desde el form de Consultorías + bucket de adjuntos |

4. Para cada uno:
   - Click **+ New query** (botón superior derecho del SQL Editor).
   - Abre el archivo `.sql` en tu editor local (VSCode, TextEdit, etc.)
     y copia **todo el contenido**.
   - Pégalo en el SQL Editor de Supabase.
   - Click **Run** (botón verde abajo a la derecha, o ⌘+Enter).
   - Espera el "Success. No rows returned" o similar antes de pasar al
     siguiente.

5. **Si una migración falla** con error `relation "X" already exists`:
   probablemente ya la aplicaste antes. Salta al siguiente archivo y
   marca cuál saltaste.

6. **Verificación final**: en el menú lateral → **Table Editor**.
   Deberías ver al menos estas tablas:
   - `profiles`
   - `posts`, `comments`
   - `agora_hilos`, `agora_respuestas`
   - `logos_posts`, `logos_pecs`, `logos_comentarios`, `logos_audio_transcripciones`
   - `consultoria_solicitudes`

---

## B. Configurar SMTP propio (para magic links)

Por defecto Supabase usa un SMTP gratuito muy limitado: ~3 emails/hora.
Inservible para una web pública. Hay que poner el tuyo.

**Recomendación**: [Resend](https://resend.com). Plan gratuito de 3.000
emails/mes y configuración en 5 minutos.

### B.1 Crear cuenta y dominio en Resend

1. Crea cuenta en [resend.com](https://resend.com).
2. Menú **Domains** → **Add Domain** → escribe `demosios.eu`.
3. Resend te dará 3 registros DNS para añadir (TXT, MX, DKIM):
   - Vete al panel de tu registrador del dominio (donde compraste
     `demosios.eu`).
   - Añade los 3 registros tal cual.
4. Vuelve a Resend y pulsa **Verify Domain**. Tarda 5–30 minutos en
   propagarse.
5. Una vez verificado: menú **API Keys** → **Create API Key** →
   nómbrala `supabase-smtp` con permiso **Sending access**. Copia la
   API key empezando por `re_...` (solo se muestra una vez).

### B.2 Conectar Supabase con Resend

1. Dashboard Supabase → **Project Settings** (engranaje abajo a la
   izquierda) → **Authentication** → pestaña **SMTP Settings**.
2. Activa **Enable Custom SMTP**.
3. Rellena:
   - **Sender email**: `noreply@demosios.eu`
   - **Sender name**: `OCRE — Demos iOS`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: pega aquí la API key `re_...` que acabas de crear.
4. **Save**.

### B.3 Personalizar plantillas de email (opcional pero recomendado)

1. Dashboard → **Authentication** → **Email Templates**.
2. Edita las plantillas:
   - **Magic Link**: cambia el texto y firma a "OCRE · Demos iOS".
   - **Confirm signup**: idem.
   - **Reset password**: idem.
3. Importante en cada plantilla: la variable `{{ .ConfirmationURL }}`
   tiene que estar en el cuerpo. No la borres.

### B.4 Probar

1. Ve a `https://www.demosios.eu/login` (o `localhost:3000/login` si
   estás en local).
2. Pon tu email, método **enlace** (default).
3. Pulsa enviar. Revisa tu correo (incluida carpeta spam) — debería
   llegar en menos de 30 segundos.
4. Pulsa el enlace → te lleva a `/auth/callback` y de ahí a `/perfil`.

Si el email no llega:
- Mira en el dashboard Resend → **Logs** si Resend lo intentó enviar.
- Mira en el dashboard Supabase → **Logs** → **Auth** si hubo error.

---

## C. Configurar Google OAuth (opcional)

Para que el botón "Entrar con Google" del `/login` funcione.

### C.1 Crear credenciales en Google Cloud

1. Entra a [Google Cloud Console](https://console.cloud.google.com).
2. Crea un proyecto nuevo o usa uno existente.
3. Menú lateral → **APIs y servicios** → **Pantalla de consentimiento
   de OAuth**.
   - **User type**: External.
   - **App name**: `OCRE — Demos iOS`.
   - **User support email**: `hola@demosios.eu`.
   - **Developer contact**: tu email.
   - Sigue los pasos. En **Scopes** añade `email`, `profile`, `openid`.
   - **Test users**: añade tu propio email (mientras la app esté en
     modo "Testing"; cuando esté lista, publícala).
4. Menú lateral → **APIs y servicios** → **Credenciales** → **Crear
   credenciales** → **ID de cliente de OAuth**.
   - **Application type**: Web application.
   - **Name**: `Supabase OCRE`.
   - **Authorized redirect URIs** — añade exactamente esta URL:
     ```
     https://zkezbitcvpjyxyyjilyx.supabase.co/auth/v1/callback
     ```
   - Crea. Copia **Client ID** y **Client secret**.

### C.2 Conectar Supabase con Google

1. Dashboard Supabase → **Authentication** → **Providers**.
2. Busca **Google** y activa **Enable Sign in with Google**.
3. Pega:
   - **Client ID**: lo de arriba.
   - **Client Secret**: lo de arriba.
4. **Save**.

### C.3 Probar

1. `https://www.demosios.eu/login` → botón "Entrar con Google".
2. Te redirige a Google → eliges cuenta → vuelves a `/auth/callback`.

---

## D. Variables de entorno de Vercel (si no están ya)

Si la web `demosios.eu` ya está deployada y funcionando, este paso
probablemente ya está hecho. Si no:

1. Dashboard Vercel → proyecto → **Settings** → **Environment
   Variables**.
2. Añade:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://zkezbitcvpjyxyyjilyx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (la que está en `.env.example`)
   - `NEXT_PUBLIC_SITE_URL` = `https://demosios.eu`
3. Re-deploy el proyecto para que las nuevas vars se apliquen.

---

## E. Crear el primer usuario admin

Una vez tengas auth funcionando, necesitas marcar al menos una cuenta
como `is_admin = true` para que pueda ver las solicitudes de
consultoría y moderar Ágora.

1. Regístrate en `https://www.demosios.eu/registro` con tu email.
2. Confirma desde el correo.
3. Dashboard Supabase → **Table Editor** → tabla `profiles`.
4. Encuentra tu fila por el email y edita la columna `is_admin` a
   `true`.

---

## Checklist resumido

- [ ] **A** 7 migraciones aplicadas en orden, sin error
- [ ] **A** Tablas verificadas en Table Editor
- [ ] **B.1** Dominio `demosios.eu` verificado en Resend
- [ ] **B.2** SMTP custom configurado en Supabase con Resend
- [ ] **B.3** Plantillas de email personalizadas
- [ ] **B.4** Magic link probado de extremo a extremo
- [ ] **C.1** Credenciales OAuth creadas en Google Cloud (opcional)
- [ ] **C.2** Provider Google activo en Supabase (opcional)
- [ ] **C.3** Login con Google probado (opcional)
- [ ] **D** Env vars confirmadas en Vercel
- [ ] **E** Tu cuenta marcada como `is_admin = true`

Cuando todos los checkboxes estén ✅, la pieza A del roadmap (config
Supabase) está cerrada y podemos pasar a C (Ágora real).
