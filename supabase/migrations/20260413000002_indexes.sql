-- ============================================================
-- KOINOS: Índices de rendimiento
-- Migración: 20260413000002_indexes.sql
-- Descripción: Índices para consultas frecuentes y claves foráneas
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────

-- Búsqueda por handle (ya tiene unique, pero explícito para claridad)
-- El unique constraint ya crea un índice, así que solo agregamos:

-- Búsqueda por código de invitación usado al registrarse
create index idx_profiles_invitation_code on profiles(invitation_code) where invitation_code is not null;

-- Filtrar usuarios shadow banned (para moderación)
create index idx_profiles_shadow_banned on profiles(is_shadow_banned) where is_shadow_banned = true;


-- ────────────────────────────────────────────────────────────
-- POSTS
-- ────────────────────────────────────────────────────────────

-- Feed principal: posts ordenados por fecha (más recientes primero)
create index idx_posts_created_at on posts(created_at desc);

-- Posts de un autor específico (perfil de usuario)
create index idx_posts_author_id on posts(author_id);

-- Filtrar por skin (para vistas temáticas)
create index idx_posts_skin on posts(skin);

-- Posts de IA (para el feed de yappers)
create index idx_posts_is_ai on posts(is_ai) where is_ai = true;

-- Feed compuesto: autor + fecha para consultas de timeline personal
create index idx_posts_author_created on posts(author_id, created_at desc);


-- ────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────

-- Comentarios de un post (la consulta más común)
create index idx_comments_post_id on comments(post_id);

-- Respuestas a un comentario (para hilos anidados)
create index idx_comments_parent_id on comments(parent_id) where parent_id is not null;

-- Comentarios por autor
create index idx_comments_author_id on comments(author_id);

-- Orden cronológico dentro de un post
create index idx_comments_post_created on comments(post_id, created_at);


-- ────────────────────────────────────────────────────────────
-- LIKES
-- ────────────────────────────────────────────────────────────

-- Contar likes de un post
create index idx_likes_post_id on likes(post_id);

-- Verificar si un usuario ya dio like (unique ya cubre esto, pero para conteos)
create index idx_likes_user_id on likes(user_id);


-- ────────────────────────────────────────────────────────────
-- PECS
-- ────────────────────────────────────────────────────────────

-- Obtener PECs de un post (mostrar avatares)
create index idx_pecs_post_id on pecs(post_id);

-- PECs dados por un usuario
create index idx_pecs_user_id on pecs(user_id);


-- ────────────────────────────────────────────────────────────
-- FOLLOWS
-- ────────────────────────────────────────────────────────────

-- "¿A quién sigo?" (para armar el feed)
create index idx_follows_follower_id on follows(follower_id);

-- "¿Quién me sigue?" (para conteo de seguidores)
create index idx_follows_following_id on follows(following_id);


-- ────────────────────────────────────────────────────────────
-- ALBUM_ITEMS
-- ────────────────────────────────────────────────────────────

-- Álbum de un usuario ordenado por fecha
create index idx_album_items_user_id on album_items(user_id, created_at desc);

-- Filtrar por tipo de contenido
create index idx_album_items_kind on album_items(user_id, kind);


-- ────────────────────────────────────────────────────────────
-- POST_MEDIA
-- ────────────────────────────────────────────────────────────

-- Media adjunta a un post, ordenada por posición
create index idx_post_media_post_id on post_media(post_id, position);


-- ────────────────────────────────────────────────────────────
-- REPORTS
-- ────────────────────────────────────────────────────────────

-- Reportes pendientes para moderación
create index idx_reports_status on reports(status) where status in ('pending', 'reviewing');

-- Reportes por usuario reportado
create index idx_reports_reported_user on reports(reported_user_id) where reported_user_id is not null;

-- Reportes por post reportado
create index idx_reports_reported_post on reports(reported_post_id) where reported_post_id is not null;


-- ────────────────────────────────────────────────────────────
-- INVITATIONS
-- ────────────────────────────────────────────────────────────

-- Buscar invitación por código (para validar al registrarse)
-- El unique en code ya crea un índice

-- Invitaciones de un creador
create index idx_invitations_created_by on invitations(created_by);

-- Invitaciones no usadas (disponibles)
create index idx_invitations_unused on invitations(code) where used_by is null;


-- ────────────────────────────────────────────────────────────
-- WAITLIST
-- ────────────────────────────────────────────────────────────

-- El unique en email ya crea un índice, suficiente para esta tabla
