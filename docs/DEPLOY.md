# Runbook de despliegue

Pasos reales para pasar OCRE de local a producción.

## 0. El dominio

**demosios.eu** — del griego *δημόσιος*, "público". Comprado en DonDominio. El registro se queda ahí; sólo moveremos el DNS a Vercel. Si en el futuro se quiere centralizar con Cloudflare (CDN + WAF + DNS en un sitio) es posible transferirlo con código de autorización, proceso de 5–7 días.

## 1. Repositorio en GitHub

```bash
cd OCRE
git init
git add .
git commit -m "Inicio de OCRE: Next.js 16, 4 secciones, preview"
# crea el repo en github.com/<tu-user>/ocre (privado)
git branch -M main
git remote add origin git@github.com:<tu-user>/ocre.git
git push -u origin main
```

Si no tienes aún clave SSH subida a GitHub, usa HTTPS con token personal.

## 2. Deploy en Vercel

1. Entra en [vercel.com](https://vercel.com/) con la cuenta de GitHub.
2. *Add New → Project* → elige el repo `ocre`.
3. Framework detectado: Next.js. Dejar los defaults (build `next build`, output `.next`).
4. Por ahora **no** añadas variables de entorno: aún no hay Supabase.
5. *Deploy*. En 60–90 segundos tendrás `ocre-xyz.vercel.app`.
6. Revisa que `/`, `/agora`, `/bibliotheka`, `/polis`, `/perfil` funcionen.

## 3. DNS en DonDominio

1. En Vercel: *Project → Settings → Domains*. Añade tu dominio (por ejemplo `demosios.eu`).
2. Vercel te mostrará los registros que tienes que crear. Típicamente:
   - `A` para apex → `76.76.21.21`
   - `CNAME` para `www` → `cname.vercel-dns.com.`
3. En DonDominio: *Panel de Control → Mis dominios → [tuDominio] → DNS → Editar zona*. Borra los registros por defecto de DonDominio, añade los que te dio Vercel, guarda.
4. Vuelve a Vercel, pulsa *Refresh* junto al dominio. Cuando aparezca `Valid Configuration`, el SSL se emite automáticamente en minutos.
5. Redirige el apex a `www` (o al revés) desde *Domains → Redirects* para no servir en dos URLs distintas.

**Propagación**: normalmente 5 minutos; como máximo 2 horas. Si tardase más, comprueba que no quedan registros viejos (TXT, MX de una web anterior) interfiriendo.

## 4. Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com/) — región más cercana (probablemente `eu-west-2 London` o `eu-west-3 Paris`).
2. Copia `anon key`, `service_role key` y `project URL` a `.env.local` (no comitear):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

3. Añade esas mismas tres variables en Vercel: *Project → Settings → Environment Variables* (marca Production + Preview + Development).
4. Copia `src/lib/supabase/client.ts` y `src/lib/supabase/server.ts` de KOINOS. Copia también `src/middleware.ts`.
5. `npm i @supabase/ssr @supabase/supabase-js`.

### Esquema mínimo

Aplicar desde el SQL editor de Supabase o vía `supabase/migrations/`:

```sql
-- perfiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  handle text unique not null check (length(handle) between 3 and 30),
  display_name text,
  avatar_url text,
  avatar_color text default '#A14B2A',
  bio text check (length(bio) <= 300),
  isla_id text,
  municipio_id text,
  barrio_id text,
  is_public boolean default true,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- contribuciones (una tabla para todo)
create type contribucion_tipo as enum (
  'video_cursus', 'recurso_koina', 'hilo_agora',
  'respuesta_agora', 'pec_recibido', 'espacio_recuperado', 'mapa_pin'
);

create table contribuciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  tipo contribucion_tipo not null,
  seccion_pharos text,
  target_id uuid,
  creada timestamptz default now()
);

create index contribuciones_user_idx on contribuciones(user_id);
create index contribuciones_tipo_idx on contribuciones(tipo);

-- RLS
alter table profiles enable row level security;
alter table contribuciones enable row level security;

create policy "perfiles públicos visibles a todos"
  on profiles for select using (is_public = true or auth.uid() = id);

create policy "tu perfil lo editas tú"
  on profiles for update using (auth.uid() = id);

create policy "tus contribuciones las lees tú y el público"
  on contribuciones for select using (
    exists (select 1 from profiles p where p.id = contribuciones.user_id
            and (p.is_public = true or auth.uid() = p.id))
  );

create policy "solo insertas contribuciones propias"
  on contribuciones for insert with check (auth.uid() = user_id);
```

### Proveedores de auth

*Authentication → Providers*:

- **Email**: activar, marcar "Confirm email" y "Secure email change". Plantilla de magic link en *Email Templates*.
- **Google**: crear OAuth client en [Google Cloud Console](https://console.cloud.google.com/), pegar client id + secret. Redirect URI: `https://xxx.supabase.co/auth/v1/callback`.

### URL de redirección

*Authentication → URL Configuration*:

- Site URL: `https://www.demosios.eu` (tu dominio real).
- Redirect URLs adicionales: `http://localhost:3000/**`, `https://*.vercel.app/**` para previews.

## 5. Primer login

Copia `src/app/auth/callback/route.ts` de KOINOS — el handler de Supabase para intercambiar el code por sesión. Añade:

- `src/app/login/page.tsx` con un formulario único de email → llama a `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/callback' } })`.
- Botón "Entrar con Google" → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback' } })`.
- Middleware (`src/middleware.ts`) que refresca sesión y protege `/perfil` y `/ajustes`.

## 6. Cablear el candado

Cuando haya auth real, el toggle de `/ajustes` hace:

```ts
await supabase.from('profiles')
  .update({ is_public: nuevoValor })
  .eq('id', user.id);
```

La RLS definida arriba ya oculta automáticamente el perfil privado a terceros.

## 7. Checklist de lanzamiento

- [ ] Dominio apunta a Vercel, SSL OK, redirect apex → www.
- [ ] `robots.txt` y `sitemap.ts` básicos (opcional pero recomendable).
- [ ] Favicon.
- [ ] Supabase: email templates traducidos al castellano.
- [ ] Política de privacidad y aviso legal (ruta `/legal`, ya existe carpeta en KOINOS de referencia).
- [ ] `is_public` por defecto: decidir política de arranque (recomendación: `true`, con aviso claro en onboarding).
- [ ] Analítica mínima no-invasiva (Plausible / Umami self-hosted).

## Referencias

- Vercel domains: https://vercel.com/docs/projects/domains
- Supabase auth con Next App Router: https://supabase.com/docs/guides/auth/server-side/nextjs
- DonDominio gestión DNS: panel "Editar zona DNS" del dominio.
