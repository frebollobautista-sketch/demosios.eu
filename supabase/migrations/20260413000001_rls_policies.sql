-- ============================================================
-- KOINOS: Políticas de Row Level Security (RLS)
-- Migración: 20260413000001_rls_policies.sql
-- Descripción: Seguridad a nivel de fila para todas las tablas
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Función auxiliar: verificar si el usuario actual es admin
-- ────────────────────────────────────────────────────────────

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and is_admin = true
  );
$$ language sql security definer stable;

-- ────────────────────────────────────────────────────────────
-- Función auxiliar: verificar si un usuario está shadow banned
-- ────────────────────────────────────────────────────────────

create or replace function is_shadow_banned(user_id uuid)
returns boolean as $$
  select coalesce(
    (select is_shadow_banned from profiles where id = user_id),
    false
  );
$$ language sql security definer stable;


-- ════════════════════════════════════════════════════════════
-- PROFILES
-- Lectura pública, escritura solo del propio perfil
-- ════════════════════════════════════════════════════════════

alter table profiles enable row level security;

-- Cualquiera puede ver perfiles (necesario para mostrar avatares, handles, etc.)
create policy "profiles_select_public"
  on profiles for select
  using (true);

-- Los usuarios pueden insertar su propio perfil al registrarse
create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

-- Los usuarios solo pueden actualizar su propio perfil
create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Solo admins pueden eliminar perfiles
create policy "profiles_delete_admin"
  on profiles for delete
  using (is_admin());


-- ════════════════════════════════════════════════════════════
-- POSTS
-- Lectura pública (excepto shadow banned), CRUD del autor
-- ════════════════════════════════════════════════════════════

alter table posts enable row level security;

-- Cualquiera puede leer posts de usuarios no shadow-banned
-- Los admins pueden ver todos los posts
create policy "posts_select_public"
  on posts for select
  using (
    not is_shadow_banned(author_id)
    or author_id = auth.uid()
    or is_admin()
  );

-- Usuarios autenticados pueden crear posts
create policy "posts_insert_auth"
  on posts for insert
  with check (author_id = auth.uid());

-- Autores pueden actualizar sus propios posts
create policy "posts_update_own"
  on posts for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Autores y admins pueden eliminar posts
create policy "posts_delete_own"
  on posts for delete
  using (author_id = auth.uid() or is_admin());


-- ════════════════════════════════════════════════════════════
-- COMMENTS
-- Lectura pública, inserción autenticada, borrado del autor
-- ════════════════════════════════════════════════════════════

alter table comments enable row level security;

-- Cualquiera puede leer comentarios
create policy "comments_select_public"
  on comments for select
  using (true);

-- Usuarios autenticados pueden crear comentarios
create policy "comments_insert_auth"
  on comments for insert
  with check (author_id = auth.uid());

-- Autores y admins pueden eliminar sus comentarios
create policy "comments_delete_own"
  on comments for delete
  using (author_id = auth.uid() or is_admin());


-- ════════════════════════════════════════════════════════════
-- LIKES
-- Lectura pública (para conteos), gestión del propio usuario
-- ════════════════════════════════════════════════════════════

alter table likes enable row level security;

-- Cualquiera puede ver likes (para contar totales)
create policy "likes_select_public"
  on likes for select
  using (true);

-- Usuarios autenticados pueden dar like
create policy "likes_insert_auth"
  on likes for insert
  with check (user_id = auth.uid());

-- Usuarios pueden quitar su propio like
create policy "likes_delete_own"
  on likes for delete
  using (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- PECS
-- Lectura pública (para mostrar avatares), gestión del usuario
-- ════════════════════════════════════════════════════════════

alter table pecs enable row level security;

-- Cualquiera puede ver PECs (son públicos por diseño)
create policy "pecs_select_public"
  on pecs for select
  using (true);

-- Usuarios autenticados pueden dar PEC
create policy "pecs_insert_auth"
  on pecs for insert
  with check (user_id = auth.uid());

-- Usuarios pueden quitar su propio PEC
create policy "pecs_delete_own"
  on pecs for delete
  using (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- FOLLOWS
-- Lectura pública, gestión de los propios seguimientos
-- ════════════════════════════════════════════════════════════

alter table follows enable row level security;

-- Cualquiera puede ver relaciones de seguimiento
create policy "follows_select_public"
  on follows for select
  using (true);

-- Usuarios pueden seguir a otros
create policy "follows_insert_own"
  on follows for insert
  with check (follower_id = auth.uid());

-- Usuarios pueden dejar de seguir
create policy "follows_delete_own"
  on follows for delete
  using (follower_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- ALBUM_ITEMS
-- Privado: solo el dueño puede ver y gestionar su álbum
-- ════════════════════════════════════════════════════════════

alter table album_items enable row level security;

-- Solo el dueño puede ver su álbum
create policy "album_items_select_own"
  on album_items for select
  using (user_id = auth.uid());

-- Solo el dueño puede agregar a su álbum
create policy "album_items_insert_own"
  on album_items for insert
  with check (user_id = auth.uid());

-- Solo el dueño puede actualizar su álbum
create policy "album_items_update_own"
  on album_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Solo el dueño puede eliminar de su álbum
create policy "album_items_delete_own"
  on album_items for delete
  using (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- POST_MEDIA
-- Mismas reglas que posts: lectura pública, gestión del autor
-- ════════════════════════════════════════════════════════════

alter table post_media enable row level security;

-- Cualquiera puede ver media de posts visibles
create policy "post_media_select_public"
  on post_media for select
  using (
    exists (
      select 1 from posts
      where posts.id = post_media.post_id
        and (not is_shadow_banned(posts.author_id) or posts.author_id = auth.uid() or is_admin())
    )
  );

-- Solo el autor del post puede agregar media
create policy "post_media_insert_author"
  on post_media for insert
  with check (
    exists (
      select 1 from posts
      where posts.id = post_media.post_id
        and posts.author_id = auth.uid()
    )
  );

-- Solo el autor del post puede eliminar media
create policy "post_media_delete_author"
  on post_media for delete
  using (
    exists (
      select 1 from posts
      where posts.id = post_media.post_id
        and posts.author_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- CITAS
-- Lectura pública, gestión solo por admins
-- ════════════════════════════════════════════════════════════

alter table citas enable row level security;

-- Cualquiera puede leer citas
create policy "citas_select_public"
  on citas for select
  using (true);

-- Solo admins pueden insertar citas
create policy "citas_insert_admin"
  on citas for insert
  with check (is_admin());

-- Solo admins pueden actualizar citas
create policy "citas_update_admin"
  on citas for update
  using (is_admin());

-- Solo admins pueden eliminar citas
create policy "citas_delete_admin"
  on citas for delete
  using (is_admin());


-- ════════════════════════════════════════════════════════════
-- YAPPERS
-- Lectura pública, gestión solo por admins
-- ════════════════════════════════════════════════════════════

alter table yappers enable row level security;

-- Cualquiera puede ver los personajes yapper
create policy "yappers_select_public"
  on yappers for select
  using (true);

-- Solo admins pueden gestionar yappers
create policy "yappers_insert_admin"
  on yappers for insert
  with check (is_admin());

create policy "yappers_update_admin"
  on yappers for update
  using (is_admin());

create policy "yappers_delete_admin"
  on yappers for delete
  using (is_admin());


-- ════════════════════════════════════════════════════════════
-- REPORTS
-- Usuarios pueden crear, admins ven y gestionan todo
-- ════════════════════════════════════════════════════════════

alter table reports enable row level security;

-- Admins pueden ver todos los reportes
-- Usuarios pueden ver sus propios reportes
create policy "reports_select"
  on reports for select
  using (reporter_id = auth.uid() or is_admin());

-- Usuarios autenticados pueden crear reportes
create policy "reports_insert_auth"
  on reports for insert
  with check (reporter_id = auth.uid());

-- Solo admins pueden actualizar reportes (cambiar estado, resolver)
create policy "reports_update_admin"
  on reports for update
  using (is_admin());


-- ════════════════════════════════════════════════════════════
-- INVITATIONS
-- Creador ve las suyas, admins ven todas, verificación pública
-- ════════════════════════════════════════════════════════════

alter table invitations enable row level security;

-- Creador puede ver sus invitaciones, admins ven todas
create policy "invitations_select"
  on invitations for select
  using (created_by = auth.uid() or is_admin());

-- Usuarios autenticados pueden crear invitaciones
create policy "invitations_insert_auth"
  on invitations for insert
  with check (created_by = auth.uid());

-- Cualquiera puede usar (actualizar) una invitación para verificar código
-- Solo permite actualizar used_by y used_at cuando aún no ha sido usada
create policy "invitations_update_use"
  on invitations for update
  using (used_by is null)
  with check (used_by = auth.uid());


-- ════════════════════════════════════════════════════════════
-- WAITLIST
-- Inserción pública (registro), lectura solo admins
-- ════════════════════════════════════════════════════════════

alter table waitlist enable row level security;

-- Cualquiera puede registrarse en la lista de espera (sin necesidad de auth)
create policy "waitlist_insert_public"
  on waitlist for insert
  with check (true);

-- Solo admins pueden ver la lista de espera
create policy "waitlist_select_admin"
  on waitlist for select
  using (is_admin());
