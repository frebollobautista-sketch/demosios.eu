"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Sparkles,
  Plus,
  X,
  Lock,
  Globe,
  Settings,
  Newspaper,
  Users,
  Landmark,
  MapPin,
  ExternalLink,
  Images,
  LayoutGrid,
  Film,
  Store,
  PenLine,
  Cpu,
  Map as MapIcon,
  Flag,
  Briefcase,
  Building2,
  Play,
  Bookmark,
  ImagePlus,
  Paperclip,
  Link as LinkIcon,
  Quote,
  FileText,
  Trash2,
  Bell,
  Search,
  ChevronUp,
  LogOut,
  Eye,
  EyeOff,
  Camera,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SECCIONES } from "@/lib/pharos/secciones";
import { CATEGORIAS } from "@/lib/pharos/categorias";
import { LANDMARKS } from "@/lib/las-palmas-data";

const PolisMap = dynamic(() => import("@/components/PolisMap"), { ssr: false });

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

type Post = {
  id: string;
  user: string;
  avatar: string;
  avatarColor: string;
  time: string;
  text: string;
  image?: string;
  isAI?: boolean;
  aiLabel?: string;
  likes: number;
  pecs: number;
  // Pre-seeded avatars that already PEC'd this post.
  // PEC is an embodied endorsement: your face is visible on the post,
  // unlike a Like, which is anonymous and just bumps a counter.
  pecers?: { initial: string; color: string }[];
  sem?: "green" | "yellow" | "red";
  // Visual skin applied to the card. Each content type can have its own
  // "piel" so the feed isn't a flat list of identical tiles. See
  // SKIN_REGISTRY for the full list.
  skin?: SkinId;
};

// ─── Post skins ──────────────────────────────────────────────────────
// Each content type wears its own "piel": background, accent stripe,
// font, and small details. Adding a new skin is additive — register it
// in SKIN_REGISTRY and reference it from post.skin.
type SkinId = "plain" | "yapper" | "devlog" | "nature" | "photo";

type Skin = {
  id: SkinId;
  bg: string;
  accent: string; // color for border-left stripe + handle + meta
  fontFamily: string;
  fontStyle: "normal" | "italic";
  textSize: number;
  badge?: { label: string; icon: "sparkles" | null };
};

const SKIN_REGISTRY: Record<SkinId, Skin> = {
  plain: {
    id: "plain",
    bg: "#FFFFFF",
    accent: "transparent",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    fontStyle: "normal",
    textSize: 14,
  },
  // Yapper = personajes históricos hablando. Generado por IA a partir
  // de una base de datos de personajes con obra cultural asociada.
  // Piel pergamino + serif itálica + stripe dorada.
  yapper: {
    id: "yapper",
    bg: "linear-gradient(145deg, #FFFFFF, #FAF5E8 60%, #F5EDD8)",
    accent: "#D4AF37",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: "italic",
    textSize: 15,
    badge: { label: "YAPPER", icon: "sparkles" },
  },
  devlog: {
    id: "devlog",
    bg: "linear-gradient(180deg, #FFFFFF, #F4F7FC)",
    accent: "#3DBBF0",
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    fontStyle: "normal",
    textSize: 13,
  },
  nature: {
    id: "nature",
    bg: "linear-gradient(180deg, #FFFFFF, #F2FBF5)",
    accent: "#2ECC87",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    fontStyle: "normal",
    textSize: 14,
  },
  photo: {
    id: "photo",
    bg: "#FFFFFF",
    accent: "#FF6B6B",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    fontStyle: "normal",
    textSize: 14,
  },
};

function skinOf(post: { skin?: SkinId; isAI?: boolean }): Skin {
  if (post.skin) return SKIN_REGISTRY[post.skin];
  if (post.isAI) return SKIN_REGISTRY.yapper;
  return SKIN_REGISTRY.plain;
}

const POSTS: Post[] = [
  {
    id: "1",
    user: "carlos.ui",
    avatar: "C",
    avatarColor: "#7C5CFC",
    time: "5m",
    text: "El diseno no es como se ve. El diseno es como funciona. Y a veces funciona mejor cuando nadie nota que esta ahi.",
    likes: 23,
    pecs: 4,
    pecers: [
      { initial: "M", color: "#3DBBF0" },
      { initial: "A", color: "#43e97b" },
      { initial: "P", color: "#FF6B6B" },
      { initial: "J", color: "#7C5CFC" },
    ],
    sem: "yellow",
  },
  {
    id: "2",
    user: "panxo93",
    avatar: "P",
    avatarColor: "#FF6B6B",
    time: "12m",
    text: "Este es Rocky. No le gusta que trabaje desde casa porque significa que le acaricio menos. Tiene razon.",
    image:
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop",
    skin: "photo",
    likes: 47,
    pecs: 8,
    pecers: [
      { initial: "A", color: "#43e97b" },
      { initial: "C", color: "#7C5CFC" },
      { initial: "M", color: "#3DBBF0" },
      { initial: "L", color: "#FFB347" },
      { initial: "R", color: "#FF6B6B" },
      { initial: "T", color: "#D4AF37" },
      { initial: "N", color: "#2ECC87" },
      { initial: "S", color: "#7C5CFC" },
    ],
    sem: "green",
  },
  {
    id: "3",
    user: "marco.aurelio",
    avatar: "MA",
    avatarColor: "#D4AF37",
    time: "",
    text: '"No desperdicies el resto de tu vida en especular sobre tus vecinos, a menos que sea por el bien comun. Piensa en lo que estas haciendo, no en lo que hacen los demas."',
    isAI: true,
    aiLabel: "Meditaciones, Libro III",
    likes: 112,
    pecs: 19,
    pecers: [
      { initial: "A", color: "#43e97b" },
      { initial: "M", color: "#3DBBF0" },
      { initial: "C", color: "#7C5CFC" },
      { initial: "P", color: "#FF6B6B" },
      { initial: "L", color: "#FFB347" },
      { initial: "E", color: "#2ECC87" },
    ],
  },
  {
    id: "4",
    user: "marina.dev",
    avatar: "M",
    avatarColor: "#3DBBF0",
    time: "28m",
    text: "Llevo tres dias con un bug que solo aparece en produccion. Hoy descubri que era un timezone. Siempre es un timezone.",
    skin: "devlog",
    likes: 89,
    pecs: 31,
    pecers: [
      { initial: "C", color: "#7C5CFC" },
      { initial: "P", color: "#FF6B6B" },
      { initial: "J", color: "#3DBBF0" },
      { initial: "R", color: "#FF6B6B" },
      { initial: "T", color: "#2ECC87" },
      { initial: "D", color: "#FFB347" },
    ],
    sem: "red",
  },
  {
    id: "5",
    user: "marco.aurelio",
    avatar: "MA",
    avatarColor: "#D4AF37",
    time: "",
    text: '"La mejor venganza es no ser como tu enemigo."',
    isAI: true,
    aiLabel: "Meditaciones, Libro VI",
    likes: 204,
    pecs: 42,
    pecers: [
      { initial: "A", color: "#43e97b" },
      { initial: "M", color: "#3DBBF0" },
      { initial: "C", color: "#7C5CFC" },
      { initial: "P", color: "#FF6B6B" },
      { initial: "L", color: "#FFB347" },
    ],
  },
  {
    id: "6",
    user: "panxo93",
    avatar: "P",
    avatarColor: "#FF6B6B",
    time: "45m",
    text: "A veces el mejor codigo es el que no escribes. Hoy borre 200 lineas y todo funciona mejor.",
    skin: "devlog",
    likes: 34,
    pecs: 6,
    pecers: [
      { initial: "M", color: "#3DBBF0" },
      { initial: "C", color: "#7C5CFC" },
      { initial: "A", color: "#43e97b" },
    ],
    sem: "green",
  },
  {
    id: "7",
    user: "ana.nature",
    avatar: "A",
    avatarColor: "#43e97b",
    time: "1h",
    text: "Tres meses sin redes sociales grandes. No echo de menos los reels. Echo de menos a la gente. Quizas por eso estoy aqui.",
    skin: "nature",
    likes: 156,
    pecs: 23,
    pecers: [
      { initial: "C", color: "#7C5CFC" },
      { initial: "M", color: "#3DBBF0" },
      { initial: "P", color: "#FF6B6B" },
      { initial: "L", color: "#FFB347" },
      { initial: "E", color: "#2ECC87" },
    ],
    sem: "yellow",
  },
  {
    id: "8",
    user: "marco.aurelio",
    avatar: "MA",
    avatarColor: "#D4AF37",
    time: "",
    text: '"Muy pronto lo habras olvidado todo; muy pronto todos te habran olvidado a ti."',
    isAI: true,
    aiLabel: "Meditaciones, Libro VII",
    likes: 87,
    pecs: 11,
    pecers: [
      { initial: "A", color: "#43e97b" },
      { initial: "M", color: "#3DBBF0" },
      { initial: "P", color: "#FF6B6B" },
      { initial: "C", color: "#7C5CFC" },
    ],
  },
];

type Item = { id: string; text: string; done: boolean };
type Checklist = { id: string; title: string; items: Item[] };

// ─── Comments / threads ─────────────────────────────────────────────
// Each comment has a parentId that forms a tree. Top-level comments on
// a post have parentId === null. Any comment can be "opened" as a new
// root in the thread view — that's the reddit-twitter branch gesture.
type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  avatarColor: string;
  text: string;
  time: string;
  likes: number;
};

const INITIAL_COMMENTS: Comment[] = [
  // Post 1 — carlos.ui (diseño)
  {
    id: "c1-1",
    postId: "1",
    parentId: null,
    author: "marina.dev",
    avatarColor: "#3DBBF0",
    text: "Totalmente. Lo mejor de mi trabajo es cuando nadie se da cuenta de que estoy ahí.",
    time: "4m",
    likes: 6,
  },
  {
    id: "c1-2",
    postId: "1",
    parentId: "c1-1",
    author: "panxo93",
    avatarColor: "#FF6B6B",
    text: "Y lo peor es cuando sí lo notan, porque normalmente es porque algo se ha roto.",
    time: "3m",
    likes: 3,
  },
  {
    id: "c1-3",
    postId: "1",
    parentId: "c1-2",
    author: "marina.dev",
    avatarColor: "#3DBBF0",
    text: "Exacto. Y luego te toca explicar por qué estaba bien antes.",
    time: "2m",
    likes: 1,
  },
  {
    id: "c1-4",
    postId: "1",
    parentId: null,
    author: "ana.nature",
    avatarColor: "#43e97b",
    text: "Me recuerda a Dieter Rams. Menos pero mejor.",
    time: "1m",
    likes: 4,
  },
  {
    id: "c1-5",
    postId: "1",
    parentId: "c1-4",
    author: "carlos.ui",
    avatarColor: "#7C5CFC",
    text: "Exacto, precisamente pensaba en él cuando escribí esto.",
    time: "30s",
    likes: 2,
  },
  // Post 3 — marco.aurelio (yapper)
  {
    id: "c3-1",
    postId: "3",
    parentId: null,
    author: "lucia.t",
    avatarColor: "#FFB347",
    text: "Esto debería estar enmarcado en la entrada de cada oficina.",
    time: "2h",
    likes: 18,
  },
  {
    id: "c3-2",
    postId: "3",
    parentId: null,
    author: "jaime.c",
    avatarColor: "#2ECC87",
    text: "Yo lo leí hace años y no me dijo nada. Lo he releído hoy y me ha atravesado.",
    time: "1h",
    likes: 12,
  },
  // Post 4 — marina.dev (devlog)
  {
    id: "c4-1",
    postId: "4",
    parentId: null,
    author: "panxo93",
    avatarColor: "#FF6B6B",
    text: "El abrazo cósmico del dev: descubrir que siempre es un timezone.",
    time: "20m",
    likes: 8,
  },
];

// PEC is an EMBODIED endorsement. Unlike a Like (anonymous +1 counter), a
// PEC pushes your profile avatar onto the post — your face is visible to
// everyone who sees it. This is what makes PEC "expensive" socially:
// it's you standing next to the idea, not a hidden thumbs up.
function PecStack({
  post,
  pressed,
  onToggle,
}: {
  post: Post;
  pressed: boolean;
  onToggle: () => void;
}) {
  const seeded = post.pecers || [];
  // If pressed, append the current user at the end of the stack.
  const ME = { initial: "YO", color: C.primary };
  const visibleCount = 4; // max mini-avatars shown
  const shown = pressed
    ? [...seeded.slice(0, visibleCount - 1), ME]
    : seeded.slice(0, visibleCount);
  const totalPecs = post.pecs + (pressed ? 1 : 0);
  const overflow = totalPecs - shown.length;

  return (
    <button
      onClick={onToggle}
      aria-label={pressed ? "Quitar PEC" : "PEC (poner tu cara)"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: pressed ? C.primary + "14" : "transparent",
        border: `1px solid ${pressed ? C.primary + "44" : C.border}`,
        borderRadius: 14,
        padding: "3px 8px 3px 4px",
        cursor: "pointer",
      }}
    >
      {/* Stack de mini avatares */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        {shown.map((p, idx) => {
          const isMe = pressed && idx === shown.length - 1;
          return (
            <div
              key={idx}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: p.color,
                color: "#fff",
                fontSize: isMe ? 8 : 9,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${C.surface}`,
                marginLeft: idx === 0 ? 0 : -7,
                boxShadow: isMe
                  ? `0 0 0 2px ${C.primary}`
                  : undefined,
                zIndex: idx,
                position: "relative",
              }}
            >
              {p.initial}
            </div>
          );
        })}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: pressed ? C.primary : C.textMuted,
          letterSpacing: 0.4,
        }}
      >
        {pressed ? "PEC!" : "PEC"}
        {overflow > 0 && (
          <span
            style={{
              marginLeft: 4,
              fontWeight: 600,
              color: C.textDim,
            }}
          >
            +{overflow}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── CommentThread · Reddit-Twitter style branching threads ──────────
// A full-screen modal that shows a post (or a comment acting as root)
// and the tree of replies underneath. Any reply can be "opened" to
// become the new root, pushing the previous root onto a breadcrumb.

type ThreadCrumb =
  | { kind: "post"; postId: string; label: string }
  | { kind: "comment"; commentId: string; label: string };

function CommentThread({
  post,
  comments,
  onClose,
  onAddComment,
}: {
  post: Post;
  comments: Comment[];
  onClose: () => void;
  onAddComment: (parentId: string | null, text: string) => void;
}) {
  // Crumbs: always starts with the post. Each "abrir hilo" pushes a crumb.
  const [crumbs, setCrumbs] = useState<ThreadCrumb[]>([
    { kind: "post", postId: post.id, label: `@${post.user}` },
  ]);
  const [draft, setDraft] = useState("");

  const currentRoot = crumbs[crumbs.length - 1];
  // Get the comment ids whose parent is the current root.
  const childrenOf = (parentId: string | null): Comment[] =>
    comments.filter((c) => c.parentId === parentId);

  // Top-level replies relative to the current root:
  const topLevel =
    currentRoot.kind === "post"
      ? childrenOf(null)
      : childrenOf(currentRoot.commentId);

  // Count total descendants of a comment (for the "abrir hilo · N" badge)
  const countDescendants = (commentId: string): number => {
    const direct = childrenOf(commentId);
    return direct.length + direct.reduce((s, c) => s + countDescendants(c.id), 0);
  };

  const openAsRoot = (c: Comment) => {
    setCrumbs((prev) => [
      ...prev,
      { kind: "comment", commentId: c.id, label: `@${c.author}` },
    ]);
  };
  const goBackTo = (idx: number) => {
    setCrumbs((prev) => prev.slice(0, idx + 1));
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const parentId =
      currentRoot.kind === "post" ? null : currentRoot.commentId;
    onAddComment(parentId, text);
    setDraft("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,16,14,0.55)",
        zIndex: 110,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          borderLeft: `1px solid ${C.border}`,
          borderRight: `1px solid ${C.border}`,
        }}
      >
        {/* Breadcrumb + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 14px",
            borderBottom: `1px solid ${C.border}`,
            background: C.surface,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
              overflowX: "auto",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {crumbs.map((c, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <span
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  {idx > 0 && (
                    <span style={{ color: C.textDim }}>›</span>
                  )}
                  <button
                    onClick={() => !isLast && goBackTo(idx)}
                    style={{
                      background: isLast ? C.secondary + "14" : "none",
                      border: "none",
                      padding: isLast ? "3px 8px" : "3px 4px",
                      borderRadius: 10,
                      color: isLast ? C.secondary : C.textMuted,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: isLast ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {c.label}
                  </button>
                </span>
              );
            })}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar hilo"
            style={{
              background: "none",
              border: "none",
              color: C.textDim,
              padding: 4,
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Root card — post or comment in focus */}
          {currentRoot.kind === "post" ? (
            <div
              style={{
                padding: "14px 16px",
                background: skinOf(post).bg,
                borderLeft: `3px solid ${skinOf(post).accent}`,
                borderBottom: `1px solid ${C.border}`,
                fontFamily: skinOf(post).fontFamily,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: post.avatarColor + "22",
                    border: `2px solid ${post.avatarColor}55`,
                    color: post.avatarColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {post.avatar}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: post.isAI ? C.gold : C.text,
                  }}
                >
                  @{post.user}
                </div>
                <div style={{ marginLeft: "auto", fontSize: 11, color: C.textDim }}>
                  {post.time}
                </div>
              </div>
              <div
                style={{
                  fontSize: skinOf(post).textSize,
                  lineHeight: 1.55,
                  color: C.text,
                  fontStyle: skinOf(post).fontStyle,
                }}
              >
                {post.text}
              </div>
              {post.isAI && post.aiLabel && (
                <div
                  style={{
                    fontSize: 11,
                    color: C.gold,
                    fontWeight: 600,
                    marginTop: 8,
                    fontFamily: skinOf(post).fontFamily,
                  }}
                >
                  — {post.aiLabel}
                </div>
              )}
            </div>
          ) : (
            (() => {
              const rc = comments.find(
                (c) => c.id === (currentRoot as { commentId: string }).commentId
              );
              if (!rc) return null;
              return (
                <div
                  style={{
                    padding: "14px 16px",
                    background: C.surface,
                    borderLeft: `3px solid ${C.secondary}`,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: rc.avatarColor + "22",
                        border: `2px solid ${rc.avatarColor}55`,
                        color: rc.avatarColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {rc.author.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                      @{rc.author}
                    </div>
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        color: C.textDim,
                      }}
                    >
                      {rc.time}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: C.text,
                    }}
                  >
                    {rc.text}
                  </div>
                </div>
              );
            })()
          )}

          {/* Replies */}
          <div
            style={{
              padding: "8px 12px 16px",
            }}
          >
            <div
              style={{
                padding: "8px 4px",
                fontSize: 10,
                fontWeight: 800,
                color: C.textMuted,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {topLevel.length} {topLevel.length === 1 ? "respuesta" : "respuestas"}
            </div>
            {topLevel.length === 0 && (
              <div
                style={{
                  padding: "16px 10px",
                  fontSize: 12,
                  color: C.textDim,
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              >
                Aún nadie ha respondido. Sé el primero.
              </div>
            )}
            {topLevel.map((c) => {
              const nested = countDescendants(c.id);
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c.avatarColor + "22",
                      border: `2px solid ${c.avatarColor}55`,
                      color: c.avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {c.author.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                        @{c.author}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim }}>· {c.time}</div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: C.text,
                        marginBottom: 6,
                      }}
                    >
                      {c.text}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 10,
                        color: C.textDim,
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Heart size={11} /> {c.likes}
                      </span>
                      <button
                        onClick={() => openAsRoot(c)}
                        style={{
                          background: C.secondary + "14",
                          border: "none",
                          color: C.secondary,
                          padding: "3px 8px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: "pointer",
                          letterSpacing: 0.3,
                          fontFamily: "inherit",
                        }}
                      >
                        Abrir hilo {nested > 0 && `· ${nested}`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reply composer */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: `1px solid ${C.border}`,
            background: C.surface,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              currentRoot.kind === "post"
                ? `Responder a @${post.user}…`
                : `Responder a @${(currentRoot as { label: string }).label.replace(/^@/, "")}…`
            }
            style={{
              flex: 1,
              padding: "10px 14px",
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 22,
              fontSize: 12,
              color: C.text,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Enviar respuesta"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "none",
              background: draft.trim() ? C.secondary : C.surfaceAlt,
              color: draft.trim() ? "#fff" : C.textDim,
              cursor: draft.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SemaforoDot({ status, size = 10 }: { status: string; size?: number }) {
  const col =
    { green: C.semGreen, yellow: C.semYellow, red: C.semRed }[status] ||
    C.semGreen;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: col,
        boxShadow: `0 0 ${size / 2}px ${col}66`,
        border: `1.5px solid ${col}`,
      }}
    />
  );
}

// Floating rail medals — mode-specific action sets.
// Each top-level mode (TOUCH / FEED / POLIS) exposes its own verbs on the
// left vertical rail. The rail swaps contents when the mode changes.
type Medal = {
  key: string;
  label: string;
  Icon: typeof Newspaper;
};

const TOUCH_MEDALS: Medal[] = [
  { key: "album", label: "Álbum", Icon: Images },
  { key: "amigos", label: "Amigos", Icon: Users },
  { key: "tableros", label: "Tableros", Icon: LayoutGrid },
  { key: "collage", label: "Collage", Icon: ImagePlus },
  { key: "video", label: "Video", Icon: Film },
  { key: "kiosko", label: "Kiosko", Icon: Store },
];

const FEED_MEDALS: Medal[] = [
  { key: "escribir", label: "Escribir", Icon: PenLine },
  { key: "amigos", label: "Amigos", Icon: Users },
  { key: "noticias", label: "Noticias", Icon: Newspaper },
  { key: "algoritmo", label: "Algoritmo", Icon: Cpu },
];

const POLIS_MEDALS: Medal[] = [
  { key: "mapear", label: "Mapear", Icon: MapIcon },
  { key: "peticionar", label: "Peticionar", Icon: Flag },
  { key: "ocupacion", label: "Ocupación", Icon: Briefcase },
  { key: "ventanilla", label: "Ventanilla", Icon: Building2 },
];

function medalsFor(mode: "touch" | "feed" | "polis"): Medal[] {
  if (mode === "touch") return TOUCH_MEDALS;
  if (mode === "polis") return POLIS_MEDALS;
  return FEED_MEDALS;
}

// Width reserved on the left of the feed column for the floating rail.
// Panels and timeline use this as `paddingLeft` so the rail never covers
// content while staying compact enough to preserve immersion.
const RAIL_GUTTER = 60;

function FloatingRail({
  medals,
  active,
  onSelect,
  accent,
}: {
  medals: Medal[];
  active: string;
  onSelect: (key: string) => void;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        top: 76,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 35,
      }}
    >
      {medals.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            title={label}
            aria-label={label}
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: isActive ? accent : C.surface,
              border: `1px solid ${isActive ? accent : C.border}`,
              color: isActive ? "#fff" : C.text,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isActive
                ? `0 6px 14px ${accent}66`
                : "0 2px 10px rgba(45,41,38,0.10)",
              transition: "all 0.2s",
              padding: 0,
            }}
          >
            <Icon size={19} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Migrated PHAROS panels ─────────────────────────────────────────

type Noticia = {
  titulo: string;
  enlace: string;
  imagen: string | null;
  descripcion: string;
  fuente: string;
  fecha: string;
};

function tiempoRelativo(fecha: string): string {
  if (!fecha) return "";
  const ahora = Date.now();
  const t = new Date(fecha).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, ahora - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function NoticiaPanel() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/noticias")
      .then((r) => r.json())
      .then((data) => {
        if (cancel) return;
        setNoticias(data.noticias || []);
        setCargando(false);
      })
      .catch(() => {
        if (cancel) return;
        setError(true);
        setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      <div style={{ padding: "16px 18px 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Noticia · Prensa
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          De los medios más leídos a lo más cercano a ti.
          Sin algoritmo opaco.
        </div>
      </div>

      {cargando && (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: C.textDim,
            fontSize: 13,
          }}
        >
          Cargando titulares…
        </div>
      )}
      {error && (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: C.textDim,
            fontSize: 13,
          }}
        >
          No se pudieron cargar las noticias.
        </div>
      )}

      <div
        style={{
          padding: "8px 14px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {noticias.map((n, i) => (
          <a
            key={i}
            href={n.enlace}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              overflow: "hidden",
              textDecoration: "none",
              color: C.text,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {n.imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={n.imagen}
                alt={n.titulo}
                style={{
                  width: "100%",
                  aspectRatio: "16/10",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            )}
            <div style={{ padding: "10px 12px" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 6,
                }}
              >
                {n.titulo}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: C.textDim,
                }}
              >
                <span style={{ fontWeight: 600 }}>{n.fuente}</span>
                <span>{tiempoRelativo(n.fecha)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function BibliotecaPanel() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      <div style={{ padding: "16px 18px 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Biblioteca · Recursos
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          Ocho ejes temáticos para entender lo común.
        </div>
      </div>
      <div
        style={{
          padding: "8px 14px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            style={{
              background: s.color,
              border: `1px solid ${s.colorTexto}33`,
              borderRadius: 14,
              padding: "14px 12px",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 120,
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 22 }}>{s.icono}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: s.colorTexto,
                lineHeight: 1.3,
              }}
            >
              {s.nombre}
            </span>
            <span
              style={{
                fontSize: 10,
                color: C.textMuted,
                lineHeight: 1.4,
              }}
            >
              {s.descripcion}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PolisPanel() {
  const [activa, setActiva] = useState<string | null>(null);
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      <div style={{ padding: "16px 18px 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Polis · Foro ciudadano
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          Hilos por categoría. Vota, propone, escucha.
        </div>
      </div>
      <div
        style={{
          padding: "8px 14px 4px",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {CATEGORIAS.map((c) => {
          const sel = activa === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiva(sel ? null : c.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 11px",
                borderRadius: 999,
                border: `1px solid ${sel ? C.secondary : C.border}`,
                background: sel ? C.secondary + "12" : C.surface,
                color: sel ? C.secondary : C.text,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span>{c.icono}</span>
              {c.nombre}
            </button>
          );
        })}
      </div>
      <div style={{ padding: "12px 14px 24px" }}>
        <div
          style={{
            background: C.surface,
            border: `1px dashed ${C.border}`,
            borderRadius: 14,
            padding: "20px 18px",
            textAlign: "center",
            color: C.textMuted,
          }}
        >
          <Landmark
            size={26}
            color={C.secondary}
            style={{ marginBottom: 8 }}
          />
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.text,
              marginBottom: 4,
            }}
          >
            {activa
              ? `Hilos sobre ${
                  CATEGORIAS.find((c) => c.id === activa)?.nombre
                }`
              : "Selecciona una categoría"}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Próximamente: hilos en vivo desde Supabase compartido
            con PHAROS.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FEED · Escribir idea ──────────────────────────────────────────

// Detecta si una URL es un vídeo reproducible. Por ahora:
// YouTube, Vimeo, o enlace directo a un fichero .mp4/.webm/.mov.
type VideoEmbed =
  | { kind: "youtube"; id: string; url: string }
  | { kind: "vimeo"; id: string; url: string }
  | { kind: "file"; url: string };

function detectVideo(url: string): VideoEmbed | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return { kind: "youtube", id: v, url };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { kind: "youtube", id, url };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return { kind: "vimeo", id, url };
    }
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u.pathname)) {
      return { kind: "file", url };
    }
  } catch {
    return null;
  }
  return null;
}

type Attachment =
  | { id: string; kind: "image"; name: string; dataUrl: string }
  | { id: string; kind: "doc"; name: string; size: number };

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Base de datos placeholder de citas. Más adelante vivirá en Supabase
// y "Sugerir cita" hará fetch random desde ahí. Por ahora un pool local.
type Cita = { text: string; author: string; source?: string };
const CITAS_DB: Cita[] = [
  {
    text: "No desperdicies el resto de tu vida en especular sobre tus vecinos, a menos que sea por el bien común.",
    author: "Marco Aurelio",
    source: "Meditaciones, III",
  },
  {
    text: "La mejor venganza es no ser como tu enemigo.",
    author: "Marco Aurelio",
    source: "Meditaciones, VI",
  },
  {
    text: "Muy pronto lo habrás olvidado todo; muy pronto todos te habrán olvidado a ti.",
    author: "Marco Aurelio",
    source: "Meditaciones, VII",
  },
  {
    text: "El hombre es la medida de todas las cosas.",
    author: "Protágoras",
  },
  {
    text: "Solo sé que no sé nada.",
    author: "Sócrates",
  },
  {
    text: "El todo es más que la suma de sus partes.",
    author: "Aristóteles",
    source: "Metafísica",
  },
  {
    text: "La verdadera sabiduría está en reconocer la propia ignorancia.",
    author: "Confucio",
  },
  {
    text: "Hay más cosas en el cielo y en la tierra, Horacio, de las que sueña tu filosofía.",
    author: "William Shakespeare",
    source: "Hamlet, Acto I",
  },
  {
    text: "Quien no pueda cambiar sus pensamientos no puede cambiar nada.",
    author: "George Bernard Shaw",
  },
  {
    text: "La libertad no consiste en hacer lo que uno quiere, sino en querer lo que uno hace.",
    author: "Jean-Paul Sartre",
  },
  {
    text: "No hay viento favorable para el que no sabe a qué puerto va.",
    author: "Séneca",
  },
  {
    text: "La única constante es el cambio.",
    author: "Heráclito",
  },
];

function randomCita(exclude?: Cita | null): Cita {
  if (CITAS_DB.length === 0) return { text: "", author: "" };
  if (CITAS_DB.length === 1) return CITAS_DB[0];
  let pick = CITAS_DB[Math.floor(Math.random() * CITAS_DB.length)];
  // Evitar repetir la misma en el siguiente randomize
  if (exclude && pick.text === exclude.text) {
    pick = CITAS_DB[(CITAS_DB.indexOf(pick) + 1) % CITAS_DB.length];
  }
  return pick;
}

function EscribirPanel() {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [videoLink, setVideoLink] = useState("");
  const [videoEmbed, setVideoEmbed] = useState<VideoEmbed | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [cita, setCita] = useState<Cita | null>(null);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            kind: "image",
            name: f.name,
            dataUrl: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(f);
    });
  };

  const addDocs = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      setAttachments((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          kind: "doc",
          name: f.name,
          size: f.size,
        },
      ]);
    });
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const applyVideoLink = () => {
    const trimmed = videoLink.trim();
    if (!trimmed) {
      setVideoEmbed(null);
      setVideoError(null);
      return;
    }
    const v = detectVideo(trimmed);
    if (v) {
      setVideoEmbed(v);
      setVideoError(null);
    } else {
      setVideoEmbed(null);
      setVideoError(
        "No reconozco el enlace. Pega YouTube, Vimeo o un .mp4/.webm directo."
      );
    }
  };

  const hasCita = cita !== null;
  const canPublish =
    draft.trim().length > 0 ||
    attachments.length > 0 ||
    videoEmbed !== null ||
    hasCita;

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      <div style={{ padding: "16px 18px 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Feed · Escribir idea
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          Lo que tengas en la cabeza. Sin métrica que presione.
        </div>
      </div>

      <div style={{ padding: "12px 18px 28px" }}>
        {/* Textarea principal */}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe tu idea…"
          rows={5}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            fontSize: 14,
            lineHeight: 1.55,
            color: C.text,
            fontFamily: "inherit",
            outline: "none",
            resize: "vertical",
          }}
        />

        {/* Adjuntos — imágenes */}
        {attachments.some((a) => a.kind === "image") && (
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
            }}
          >
            {attachments
              .filter((a) => a.kind === "image")
              .map((a) => (
                <div
                  key={a.id}
                  style={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: C.surfaceAlt,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(a as Attachment & { dataUrl: string }).dataUrl}
                    alt={a.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    onClick={() => removeAttachment(a.id)}
                    aria-label="Quitar imagen"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Adjuntos — documentos */}
        {attachments.some((a) => a.kind === "doc") && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {attachments
              .filter((a) => a.kind === "doc")
              .map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: C.secondary + "14",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={16} color={C.secondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.textDim,
                        marginTop: 1,
                      }}
                    >
                      {humanSize((a as Attachment & { size: number }).size)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    aria-label="Quitar documento"
                    style={{
                      background: "none",
                      border: "none",
                      color: C.textDim,
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Embed de vídeo */}
        {videoEmbed && (
          <div
            style={{
              marginTop: 10,
              borderRadius: 12,
              overflow: "hidden",
              border: `1px solid ${C.border}`,
              background: "#000",
              position: "relative",
            }}
          >
            {videoEmbed.kind === "youtube" && (
              <iframe
                title="Vídeo YouTube"
                src={`https://www.youtube-nocookie.com/embed/${videoEmbed.id}`}
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  border: "none",
                  display: "block",
                }}
                allowFullScreen
              />
            )}
            {videoEmbed.kind === "vimeo" && (
              <iframe
                title="Vídeo Vimeo"
                src={`https://player.vimeo.com/video/${videoEmbed.id}`}
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  border: "none",
                  display: "block",
                }}
                allowFullScreen
              />
            )}
            {videoEmbed.kind === "file" && (
              <video
                src={videoEmbed.url}
                controls
                playsInline
                style={{
                  width: "100%",
                  display: "block",
                  background: "#000",
                }}
              />
            )}
            <button
              onClick={() => {
                setVideoEmbed(null);
                setVideoLink("");
              }}
              aria-label="Quitar vídeo"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Barra de acciones del composer */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 11px",
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              color: C.textMuted,
              cursor: "pointer",
            }}
          >
            <ImagePlus size={13} />
            Foto
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addImages(e.target.files)}
              style={{ display: "none" }}
            />
          </label>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 11px",
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              color: C.textMuted,
              cursor: "pointer",
            }}
          >
            <Paperclip size={13} />
            Documento
            <input
              type="file"
              accept=".pdf,.doc,.docx,.odt,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.txt,.md,.csv"
              multiple
              onChange={(e) => addDocs(e.target.files)}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* Input de enlace de vídeo */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: C.surface,
              border: `1px solid ${videoError ? C.semRed : C.border}`,
              borderRadius: 20,
            }}
          >
            <LinkIcon size={12} color={C.textDim} />
            <input
              type="url"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              onBlur={applyVideoLink}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyVideoLink();
                }
              }}
              placeholder="Enlace de vídeo (YouTube, Vimeo, .mp4…)"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 12,
                color: C.text,
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
        {videoError && (
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              color: C.semRed,
              paddingLeft: 6,
            }}
          >
            {videoError}
          </div>
        )}

        {/* Bloque de cita sugerida (aleatoria desde la base de datos) */}
        {cita && (
          <div
            style={{
              marginTop: 12,
              padding: "14px 16px 14px",
              background: C.surface,
              border: `1px dashed ${C.secondary}55`,
              borderRadius: 14,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 10,
              }}
            >
              <Quote size={14} color={C.secondary} />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.secondary,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Cita sugerida
              </div>
              <button
                onClick={() => setCita(randomCita(cita))}
                aria-label="Otra cita"
                title="Otra cita"
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  background: C.secondary + "14",
                  color: C.secondary,
                  border: "none",
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Otra
              </button>
              <button
                onClick={() => setCita(null)}
                aria-label="Quitar cita"
                style={{
                  background: "none",
                  border: "none",
                  color: C.textDim,
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: C.text,
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
                marginBottom: 8,
              }}
            >
              &ldquo;{cita.text}&rdquo;
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                fontWeight: 700,
              }}
            >
              — {cita.author}
              {cita.source && (
                <span style={{ color: C.textDim, fontWeight: 500 }}>
                  , {cita.source}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Botón Sugerir cita (solo si aún no hay una seleccionada) */}
        {!cita && (
          <button
            onClick={() => setCita(randomCita())}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: `1px dashed ${C.secondary}66`,
              borderRadius: 12,
              color: C.secondary,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Quote size={14} />
            Sugerir cita
          </button>
        )}

        {/* Footer — caracteres + publicar */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.textDim,
              flex: 1,
            }}
          >
            {draft.length} caracteres
            {attachments.length > 0 && ` · ${attachments.length} adjuntos`}
            {videoEmbed && " · vídeo"}
            {hasCita && " · cita"}
          </div>
          <button
            disabled={!canPublish}
            style={{
              padding: "9px 18px",
              background: canPublish ? C.secondary : C.surfaceAlt,
              color: canPublish ? "#fff" : C.textDim,
              border: "none",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              cursor: canPublish ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FEED · Crear algoritmo ────────────────────────────────────────
// Surfaces the 8 PHAROS thematic sections as toggleable interests.
// Shapes the user's feed by picking which axes they care about.

function AlgoritmoPanel() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  const count = Object.values(selected).filter(Boolean).length;
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      <div style={{ padding: "16px 18px 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Feed · Crear algoritmo
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          Elige los ejes que te importan. Tu feed se adapta.
          {count > 0 && ` · ${count} activos`}
        </div>
      </div>
      <div
        style={{
          padding: "8px 14px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {SECCIONES.map((s) => {
          const on = selected[s.id];
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                background: on ? s.color : C.surface,
                border: `1px solid ${on ? s.colorTexto : C.border}`,
                borderRadius: 14,
                padding: "14px 12px",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minHeight: 110,
                fontFamily: "inherit",
                position: "relative",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 20 }}>{s.icono}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: on ? s.colorTexto : C.text,
                  lineHeight: 1.3,
                }}
              >
                {s.nombre}
              </span>
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: on ? s.colorTexto : "transparent",
                  border: `1.5px solid ${on ? s.colorTexto : C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {on ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── TOUCH · Álbum ────────────────────────────────────────────────
// Colección personal (red cerrada): posts y vídeos guardados.
// Regla clave: la caption NO se muestra en el grid — pulsar la foto
// revela el texto. Es un acto deliberado, no un scroll pasivo.

type AlbumItem = {
  id: string;
  kind: "photo" | "video";
  src: string;
  caption: string;
  author: string;
  savedAt: string; // texto relativo
  durationSec?: number; // solo vídeos
};

const ALBUM_ITEMS: AlbumItem[] = [
  {
    id: "a1",
    kind: "photo",
    src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=600&fit=crop",
    caption:
      "Primera vez que vuelvo a esta cala desde que nos conocimos. La marea estaba justo como aquel día.",
    author: "nuria.rm",
    savedAt: "hace 2 días",
  },
  {
    id: "a2",
    kind: "video",
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop",
    caption:
      "Timelapse de la niebla bajando por el valle. 40 minutos condensados en 12 segundos.",
    author: "jaime.c",
    savedAt: "hace 3 días",
    durationSec: 12,
  },
  {
    id: "a3",
    kind: "photo",
    src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=600&fit=crop",
    caption:
      "Subida al pico. Cinco horas, tres capas de ropa y un bocadillo de tortilla que supo a gloria arriba.",
    author: "lucia.t",
    savedAt: "hace 5 días",
  },
  {
    id: "a4",
    kind: "photo",
    src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=600&fit=crop",
    caption:
      "La montaña sigue ahí. Nosotros cambiamos más rápido que ella, y eso me parece justo.",
    author: "pablo.m",
    savedAt: "hace 1 semana",
  },
  {
    id: "a5",
    kind: "video",
    src: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600&h=600&fit=crop",
    caption:
      "La ola de las siete. Nunca falla. Lo grabé con el móvil en una bolsa de plástico.",
    author: "rafa.surf",
    savedAt: "hace 1 semana",
    durationSec: 8,
  },
  {
    id: "a6",
    kind: "photo",
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&h=600&fit=crop",
    caption:
      "Tres veranos después del incendio, el bosque vuelve. La naturaleza no pide permiso.",
    author: "marina.e",
    savedAt: "hace 2 semanas",
  },
  {
    id: "a7",
    kind: "photo",
    src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&h=600&fit=crop",
    caption:
      "Este lago lo descubrí por accidente. No voy a decir dónde está. Perdón.",
    author: "iker.n",
    savedAt: "hace 2 semanas",
  },
  {
    id: "a8",
    kind: "video",
    src: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=600&fit=crop",
    caption:
      "Caballos al amanecer, sin música de fondo. Solo se oye el viento y las pezuñas.",
    author: "elena.r",
    savedAt: "hace 3 semanas",
    durationSec: 22,
  },
  {
    id: "a9",
    kind: "photo",
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&h=600&fit=crop",
    caption:
      "Cuando el cielo se despeja después de una tormenta nunca es el mismo cielo de antes.",
    author: "dani.s",
    savedAt: "hace 1 mes",
  },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AlbumPanel() {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = ALBUM_ITEMS.find((i) => i.id === openId) || null;

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      {/* Encabezado */}
      <div
        style={{
          padding: "16px 16px 10px",
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.primary,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Touch · Álbum
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.textMuted,
            lineHeight: 1.4,
          }}
        >
          Tu colección cerrada. Pulsa una foto para leer la caption.
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textDim,
            marginTop: 6,
          }}
        >
          {ALBUM_ITEMS.length} guardados · {ALBUM_ITEMS.filter((i) => i.kind === "video").length} vídeos
        </div>
      </div>

      {/* Grid 3 columnas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          padding: 2,
        }}
      >
        {ALBUM_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setOpenId(item.id)}
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: C.surfaceAlt,
              overflow: "hidden",
            }}
            aria-label={`Abrir ${item.kind} de ${item.author}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {item.kind === "video" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)",
                  pointerEvents: "none",
                }}
              />
            )}
            {item.kind === "video" && (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "2px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                <Play size={9} fill="#fff" color="#fff" />
                {item.durationSec ? formatDuration(item.durationSec) : ""}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Modal de lectura */}
      {open && (
        <AlbumModal item={open} onClose={() => setOpenId(null)} />
      )}

      {/* Espaciado inferior */}
      <div style={{ height: 40 }} />
    </div>
  );
}

function AlbumModal({
  item,
  onClose,
}: {
  item: AlbumItem;
  onClose: () => void;
}) {
  const [showCaption, setShowCaption] = useState(true);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,16,14,0.92)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={onClose}
    >
      {/* Botón cerrar */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          border: "none",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2,
        }}
        aria-label="Cerrar"
      >
        <X size={18} />
      </button>

      {/* Imagen */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          aspectRatio: "1 / 1",
          margin: "0 12px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowCaption((v) => !v);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 14,
            display: "block",
          }}
        />

        {item.kind === "video" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play size={28} fill="#fff" color="#fff" />
            </div>
          </div>
        )}

        {/* Caption overlay — aparece solo si showCaption */}
        {showCaption && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "16px 14px 14px",
              borderRadius: "0 0 14px 14px",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.9) 100%)",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                opacity: 0.85,
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 700 }}>@{item.author}</span>
              <span>·</span>
              <span>{item.savedAt}</span>
              {item.kind === "video" && item.durationSec && (
                <>
                  <span>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Play size={9} fill="#fff" color="#fff" />
                    {formatDuration(item.durationSec)}
                  </span>
                </>
              )}
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.45,
                fontWeight: 500,
              }}
            >
              {item.caption}
            </div>
          </div>
        )}
      </div>

      {/* Hint inferior */}
      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 11,
          marginTop: 14,
          textAlign: "center",
          padding: "0 24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showCaption
          ? "Pulsa la foto para ocultar la caption"
          : "Pulsa la foto para leer la caption"}
      </div>
    </div>
  );
}

// ─── TOUCH · Amigos — tinder-style friend feed ─────────────────────
// The Amigos submodo within TOUCH shows posts from the user's intimate
// circle as a fullscreen card stack. All interaction is gesture-driven:
//   swipe ↓ = save to album
//   swipe ↑ = pass / skip
//   swipe → = PEC (avatar appears on the post)
//   double-tap = like (qualitative, no counter)
//   long-press = reveal caption text
// No bottom bar, no metrics — purely tactile.

type AmigoPost = {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  caption: string;
  gradient: string;
  skin: "polaroid" | "film" | "glass" | "raw" | "postcard";
  pecAvatars: { initial: string; color: string }[];
  qualitative: string;
};

const AMIGO_POSTS: AmigoPost[] = [
  {
    id: "am1", name: "Elena", avatar: "E", avatarColor: "#FF8C00",
    caption: "Amanecer sobre el Teide — un regalo que me dio el silencio",
    gradient: "linear-gradient(135deg, #FF8C00 0%, #FF6347 50%, #8B4513 100%)",
    skin: "polaroid",
    pecAvatars: [{ initial: "M", color: "#3DBBF0" }, { initial: "D", color: "#8B4513" }],
    qualitative: "Le gustó a varias personas",
  },
  {
    id: "am2", name: "David", avatar: "D", avatarColor: "#5D4037",
    caption: "Mi abuela cumple 90 hoy. Aquí están sus manos.",
    gradient: "linear-gradient(135deg, #3E2723 0%, #5D4037 50%, #8D6E63 100%)",
    skin: "film",
    pecAvatars: [{ initial: "E", color: "#FF8C00" }, { initial: "A", color: "#43e97b" }, { initial: "M", color: "#3DBBF0" }],
    qualitative: "Le encantó a bastantes",
  },
  {
    id: "am3", name: "Marta", avatar: "M", avatarColor: "#D2B48C",
    caption: "Un café y un libro. La tarde completa.",
    gradient: "linear-gradient(135deg, #8B7355 0%, #D2B48C 50%, #F5DEB3 100%)",
    skin: "postcard",
    pecAvatars: [{ initial: "P", color: "#FF6B6B" }],
    qualitative: "Le gustó a algunos",
  },
  {
    id: "am4", name: "Carlos", avatar: "C", avatarColor: "#4facfe",
    caption: "El agua es tan transparente que parece que las piedras flotan. No es Photoshop.",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #0077B6 100%)",
    skin: "glass",
    pecAvatars: [{ initial: "A", color: "#43e97b" }, { initial: "E", color: "#FF8C00" }],
    qualitative: "Le gustó a mucha gente",
  },
  {
    id: "am5", name: "Ana", avatar: "A", avatarColor: "#43e97b",
    caption: "Tres días caminando. Sin señal, sin WiFi, sin prisa. La selva te enseña a escuchar.",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 50%, #1B5E20 100%)",
    skin: "raw",
    pecAvatars: [{ initial: "P", color: "#FF6B6B" }, { initial: "M", color: "#D2B48C" }, { initial: "C", color: "#4facfe" }, { initial: "D", color: "#5D4037" }],
    qualitative: "Le gustó a mucha gente",
  },
  {
    id: "am6", name: "Lucía", avatar: "L", avatarColor: "#fa709a",
    caption: "Los colores, los olores, el ruido. Bangkok de noche es una fiesta para los sentidos.",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 50%, #ff9a9e 100%)",
    skin: "polaroid",
    pecAvatars: [{ initial: "M", color: "#3DBBF0" }, { initial: "P", color: "#FF6B6B" }, { initial: "A", color: "#43e97b" }],
    qualitative: "Le encantó a muchos",
  },
  {
    id: "am7", name: "Pablo", avatar: "P", avatarColor: "#FF6B6B",
    caption: "Madrid bajo la lluvia es otra ciudad. Salid a fotografiarla.",
    gradient: "linear-gradient(135deg, #636363 0%, #a2ab58 50%, #4A6274 100%)",
    skin: "film",
    pecAvatars: [{ initial: "A", color: "#43e97b" }, { initial: "C", color: "#4facfe" }],
    qualitative: "Le gustó a algunos",
  },
  {
    id: "am8", name: "Marina", avatar: "M", avatarColor: "#3DBBF0",
    caption: "Encontré esta calle sin nombre en Vegueta. Las paredes hablan si las miras despacio.",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #3B3086 100%)",
    skin: "glass",
    pecAvatars: [{ initial: "E", color: "#FF8C00" }, { initial: "L", color: "#fa709a" }],
    qualitative: "Le gustó a varias personas",
  },
];

function AmigosPanel() {
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [pecedAmigos, setPecedAmigos] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const total = AMIGO_POSTS.length;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 800);
  };

  const advance = () => {
    if (idx < total - 1) {
      setIdx(idx + 1);
      setShowCaption(false);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (showCaption) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    setDragging(true);
    // Long-press detection
    pressTimer.current = setTimeout(() => {
      setShowCaption(true);
      setDragging(false);
      setDragX(0);
      setDragY(0);
    }, 500);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    // If user moves enough, cancel long-press
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    }
    setDragX(dx);
    setDragY(dy);
  };

  const onUp = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (showCaption) { setShowCaption(false); return; }
    if (!dragging) return;
    setDragging(false);
    const post = AMIGO_POSTS[idx];

    // Swipe RIGHT → PEC
    if (dragX > 70) {
      setPecedAmigos((p) => ({ ...p, [post.id]: true }));
      showFeedback("PEC!");
      advance();
    }
    // Swipe DOWN → Save
    else if (dragY > 70) {
      setSaved((p) => ({ ...p, [post.id]: true }));
      showFeedback("📌 Guardado");
      advance();
    }
    // Swipe UP → Pass
    else if (dragY < -70) {
      showFeedback("Pasar");
      advance();
    }
    // Double tap → Like
    else if (Math.abs(dragX) < 10 && Math.abs(dragY) < 10) {
      const now = Date.now();
      if (now - lastTap.current < 350) {
        setLiked((p) => ({ ...p, [post.id]: true }));
        showFeedback("♡");
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }

    setDragX(0);
    setDragY(0);
  };

  // Skin styles applied as overlay effects on the card
  const skinStyle = (skin: AmigoPost["skin"]): React.CSSProperties => {
    switch (skin) {
      case "polaroid":
        return { borderRadius: 4, border: "8px solid #fff", boxShadow: "2px 4px 16px rgba(0,0,0,0.15)" };
      case "film":
        return { borderRadius: 2 };
      case "postcard":
        return { borderRadius: 6, border: "3px solid #F5DEB3" };
      case "glass":
        return { borderRadius: 16 };
      case "raw":
        return { borderRadius: 0 };
      default:
        return {};
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: "hidden",
        background: "#1a1a1a",
        paddingLeft: RAIL_GUTTER,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 3, padding: "8px 12px 4px", flexShrink: 0, zIndex: 20 }}>
        {AMIGO_POSTS.map((_, i) => (
          <div key={i} style={{
            height: 3,
            flex: i === idx ? 2 : 1,
            borderRadius: 2,
            background: i < idx ? "rgba(255,255,255,0.6)" : i === idx ? "#fff" : "rgba(255,255,255,0.25)",
            transition: "all 0.3s",
          }} />
        ))}
      </div>

      {/* Card stack area */}
      <div
        style={{ flex: 1, position: "relative", touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {AMIGO_POSTS.map((post, i) => {
          const off = i - idx;
          if (off < -1 || off > 2) return null;
          const isActive = off === 0;
          const x = isActive ? dragX : 0;
          const y = isActive ? dragY : 0;
          const sc = isActive ? 1 : 1 - off * 0.05;
          const ty = isActive ? 0 : off * 8;
          const op = isActive ? 1 : off === 1 ? 0.5 : 0.25;
          const rot = isActive ? dragX * 0.015 : 0;

          // Margin inside the card area — keep a bit of breathing room
          const pad = post.skin === "raw" ? 0 : post.skin === "polaroid" ? 8 : 6;

          return (
            <div
              key={post.id}
              style={{
                position: "absolute",
                inset: `${pad}px ${pad}px ${pad + 4}px ${pad}px`,
                transform: `translateX(${x}px) translateY(${y + ty}px) scale(${sc}) rotate(${rot}deg)`,
                opacity: op,
                transition: dragging && isActive ? "none" : "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                zIndex: 10 - off,
                pointerEvents: isActive ? "auto" : "none",
                ...skinStyle(post.skin),
                overflow: "hidden",
              }}
            >
              {/* Photo background */}
              <div style={{
                position: "absolute", inset: 0,
                background: post.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.2 }}>
                  <Camera size={36} color="#fff" />
                </div>
              </div>

              {/* Film bars for "film" skin */}
              {post.skin === "film" && (
                <>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 28, background: "rgba(0,0,0,0.85)", zIndex: 3 }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: "rgba(0,0,0,0.85)", zIndex: 3 }} />
                </>
              )}

              {/* Postcard stamp for "postcard" skin */}
              {post.skin === "postcard" && (
                <div style={{
                  position: "absolute", top: 8, right: 8, width: 32, height: 38,
                  border: "1.5px dashed rgba(255,255,255,0.4)", borderRadius: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, zIndex: 5,
                }}>
                  📮
                </div>
              )}

              {/* Raw vignette */}
              {post.skin === "raw" && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
                  background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
                }} />
              )}

              {/* Bottom gradient */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: showCaption ? "100%" : "45%",
                background: showCaption ? "rgba(0,0,0,0.55)" : "linear-gradient(transparent, rgba(0,0,0,0.5))",
                transition: "all 0.4s",
                backdropFilter: showCaption ? "blur(3px)" : "none",
                zIndex: 4,
              }} />

              {/* Author info — top left */}
              <div style={{
                position: "absolute", top: post.skin === "film" ? 34 : 10, left: 10,
                display: "flex", alignItems: "center", gap: 6, zIndex: 6,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: post.avatarColor, border: "2px solid rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                }}>
                  {post.avatar}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                  {post.name}
                </span>
              </div>

              {/* Bottom content — qualitative + PEC avatars */}
              <div style={{ position: "absolute", bottom: post.skin === "film" ? 34 : 10, left: 12, right: 12, zIndex: 6 }}>
                {/* Caption overlay (long-press) */}
                {showCaption && isActive && (
                  <div style={{
                    marginBottom: 10, padding: "12px 14px",
                    background: "rgba(255,255,255,0.12)", borderRadius: 14,
                    backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)",
                  }}>
                    <p style={{ color: "#fff", fontSize: 14, lineHeight: 1.6, margin: 0, textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
                      {post.caption}
                    </p>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 6, display: "block" }}>
                      Suelta para cerrar
                    </span>
                  </div>
                )}

                {/* Qualitative + PEC stack */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
                    {post.qualitative}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {pecedAmigos[post.id] && (
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: C.primary,
                        border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 800, color: "#fff", marginRight: -6, zIndex: 5,
                      }}>P</div>
                    )}
                    {post.pecAvatars.slice(0, 3).map((pa, pi) => (
                      <div key={pi} style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: pa.color, border: "1.5px solid rgba(255,255,255,0.6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 700, color: "#fff",
                        marginLeft: pi > 0 ? -6 : 0,
                      }}>{pa.initial}</div>
                    ))}
                    {post.pecAvatars.length > 3 && (
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginLeft: 2 }}>
                        +{post.pecAvatars.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Like indicator */}
                {liked[post.id] && (
                  <div style={{ marginTop: 4, fontSize: 10, color: C.primary, fontWeight: 700 }}>
                    ♡ Te gustó
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Swipe direction feedback overlay */}
        {dragging && dragX > 30 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            fontSize: 14, fontWeight: 800, color: C.primary, letterSpacing: 1.5,
            background: "rgba(0,0,0,0.6)", padding: "8px 18px", borderRadius: 20,
            zIndex: 30, backdropFilter: "blur(4px)",
          }}>PEC!</div>
        )}
        {dragging && dragY > 30 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            fontSize: 14, fontWeight: 800, color: C.semGreen, letterSpacing: 1,
            background: "rgba(0,0,0,0.6)", padding: "8px 18px", borderRadius: 20,
            zIndex: 30, backdropFilter: "blur(4px)",
          }}>📌 Guardar</div>
        )}
        {dragging && dragY < -30 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            fontSize: 14, fontWeight: 800, color: C.semYellow, letterSpacing: 1,
            background: "rgba(0,0,0,0.6)", padding: "8px 18px", borderRadius: 20,
            zIndex: 30, backdropFilter: "blur(4px)",
          }}>Pasar</div>
        )}

        {/* Post-action feedback */}
        {feedback && (
          <div style={{
            position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)",
            fontSize: feedback === "♡" ? 48 : 16, fontWeight: 800,
            color: feedback === "PEC!" ? C.primary : feedback === "♡" ? C.primary : "#fff",
            zIndex: 40, pointerEvents: "none",
            animation: "none",
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}>{feedback}</div>
        )}

        {/* End of stack */}
        {idx >= total && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, color: "rgba(255,255,255,0.5)",
          }}>
            <Users size={28} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>No hay más por ahora</span>
            <button
              onClick={() => setIdx(0)}
              style={{
                marginTop: 8, padding: "6px 16px", background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12,
                color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >Volver al inicio</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOUCH · Tableros — Pinterest-style project boards ──────────────
// Tableros represent a second view of the user's profile alongside Álbum.
// Where Álbum is personal photos, Tableros are curated photographic
// projects organized in grids. Each board is a 3×3 (or variable) grid
// of themed sub-sections forming a coherent visual project.

type TableroCell = { label: string; gradient: string };
type Tablero = {
  id: string;
  title: string;
  author: string;
  avatar: string;
  avatarColor: string;
  cells: TableroCell[];
  savedAt: string;
};

const TABLEROS: Tablero[] = [
  {
    id: "tb1",
    title: "Vegueta en 9 miradas",
    author: "panxo93",
    avatar: "P",
    avatarColor: "#FF6B6B",
    savedAt: "hace 3 días",
    cells: [
      { label: "Fachadas", gradient: "linear-gradient(135deg, #FF6B6B, #FF8E7F)" },
      { label: "Puertas", gradient: "linear-gradient(135deg, #FFB347, #FFC26F)" },
      { label: "Ventanas", gradient: "linear-gradient(135deg, #D4AF37, #E0C158)" },
      { label: "Patios", gradient: "linear-gradient(135deg, #7C5CFC, #9D7EFE)" },
      { label: "Callejones", gradient: "linear-gradient(135deg, #3DBBF0, #6DD4FF)" },
      { label: "Balcones", gradient: "linear-gradient(135deg, #2ECC87, #5DD9A3)" },
      { label: "Texturas", gradient: "linear-gradient(135deg, #8B7355, #C4A24D)" },
      { label: "Luces", gradient: "linear-gradient(135deg, #fa709a, #fee140)" },
      { label: "Gente", gradient: "linear-gradient(135deg, #667eea, #764ba2)" },
    ],
  },
  {
    id: "tb2",
    title: "Mercado de Vegueta",
    author: "marina.e",
    avatar: "M",
    avatarColor: "#3DBBF0",
    savedAt: "hace 1 semana",
    cells: [
      { label: "Frutas", gradient: "linear-gradient(135deg, #f5af19, #f12711)" },
      { label: "Pescado", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)" },
      { label: "Flores", gradient: "linear-gradient(135deg, #f093fb, #f5576c)" },
      { label: "Puestos", gradient: "linear-gradient(135deg, #8B7355, #D2B48C)" },
      { label: "Gente", gradient: "linear-gradient(135deg, #43e97b, #38f9d7)" },
      { label: "Manos", gradient: "linear-gradient(135deg, #5D4037, #8D6E63)" },
    ],
  },
  {
    id: "tb3",
    title: "Atardecer Confital",
    author: "elena.r",
    avatar: "E",
    avatarColor: "#FF8C00",
    savedAt: "hace 2 semanas",
    cells: [
      { label: "Rocas", gradient: "linear-gradient(135deg, #3E2723, #5D4037)" },
      { label: "Espuma", gradient: "linear-gradient(135deg, #e0eafc, #cfdef3)" },
      { label: "Cielo", gradient: "linear-gradient(135deg, #FF8C00, #FF6347)" },
      { label: "Siluetas", gradient: "linear-gradient(135deg, #1a1a2e, #16213e)" },
    ],
  },
];

function TablerosPanel() {
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<number | null>(null);
  const board = TABLEROS.find((t) => t.id === openBoard) || null;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg, paddingLeft: RAIL_GUTTER }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>
          Tableros · Tus proyectos
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
          Organiza series fotográficas en cuadrículas temáticas
        </div>
      </div>

      {/* Pinterest-style masonry grid */}
      <div style={{
        padding: "8px 12px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}>
        {TABLEROS.map((tb) => {
          // Mini-preview: show a 3×3 (or smaller) grid of the cells
          const gridSize = tb.cells.length <= 4 ? 2 : 3;
          return (
            <button
              key={tb.id}
              onClick={() => setOpenBoard(tb.id)}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {/* Mini grid preview */}
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gap: 2,
                borderRadius: 6,
                overflow: "hidden",
                aspectRatio: "1",
              }}>
                {tb.cells.slice(0, gridSize * gridSize).map((cell, ci) => (
                  <div key={ci} style={{
                    background: cell.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 6, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
                      {cell.label}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
                  {tb.title}
                </div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: tb.avatarColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 7, fontWeight: 800, color: "#fff",
                  }}>{tb.avatar}</div>
                  {tb.author} · {tb.cells.length} celdas · {tb.savedAt}
                </div>
              </div>
            </button>
          );
        })}

        {/* Create new board button */}
        <button
          style={{
            background: C.surfaceAlt,
            border: `2px dashed ${C.border}`,
            borderRadius: 10,
            padding: 16,
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 6, minHeight: 140,
          }}
        >
          <Plus size={20} color={C.textDim} />
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textDim }}>Nuevo tablero</span>
        </button>
      </div>

      {/* Board detail modal */}
      {board && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "90%", maxWidth: 380, maxHeight: "85vh",
            background: C.surface, borderRadius: 16,
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            {/* Board header */}
            <div style={{
              padding: "14px 16px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{board.title}</div>
                <div style={{ fontSize: 10, color: C.textDim, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", background: board.avatarColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 800, color: "#fff",
                  }}>{board.avatar}</div>
                  {board.author} · {board.cells.length} apartados
                </div>
              </div>
              <button onClick={() => { setOpenBoard(null); setExpandedCell(null); }} style={{
                background: C.surfaceAlt, border: "none", borderRadius: "50%",
                width: 28, height: 28, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={14} color={C.textMuted} />
              </button>
            </div>

            {/* Board grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${board.cells.length <= 4 ? 2 : 3}, 1fr)`,
                gap: 4,
                borderRadius: 8,
                overflow: "hidden",
              }}>
                {board.cells.map((cell, ci) => (
                  <button
                    key={ci}
                    onClick={() => setExpandedCell(expandedCell === ci ? null : ci)}
                    style={{
                      aspectRatio: "1",
                      background: cell.gradient,
                      border: expandedCell === ci ? `2px solid ${C.primary}` : "none",
                      cursor: "pointer",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      gap: 2, position: "relative",
                    }}
                  >
                    <Camera size={16} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                      {cell.label}
                    </span>
                    <span style={{
                      position: "absolute", top: 3, left: 4,
                      fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.3)",
                    }}>{ci + 1}</span>
                  </button>
                ))}
              </div>

              {/* Expanded cell detail */}
              {expandedCell !== null && board.cells[expandedCell] && (
                <div style={{
                  marginTop: 10, padding: 12,
                  background: C.surfaceAlt, borderRadius: 10,
                  borderLeft: `3px solid ${C.primary}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                    {expandedCell + 1}. {board.cells[expandedCell].label}
                  </div>
                  <div style={{
                    marginTop: 8, height: 120, borderRadius: 8,
                    background: board.cells[expandedCell].gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Camera size={28} color="rgba(255,255,255,0.25)" />
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                    Apartado del tablero «{board.title}»
                  </p>
                </div>
              )}

              <p style={{
                fontSize: 10, color: C.textDim, textAlign: "center",
                marginTop: 14, lineHeight: 1.5,
              }}>
                Este tablero organiza {board.cells.length} apartados de un proyecto fotográfico
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOUCH · Collage — creation tool for multi-photo compositions ───
// Collage is the creation tool: compose multiple photos into a single
// visual layout. It can also be the entry point to create a new tablero.

type CollageLayout = {
  id: string;
  label: string;
  slots: number;
  grid: string; // CSS grid-template-areas shorthand
  cols: string;
  rows: string;
  areas: string[];
};

const COLLAGE_LAYOUTS: CollageLayout[] = [
  { id: "2h", label: "2 lado", slots: 2, cols: "1fr 1fr", rows: "1fr", grid: "'a b'", areas: ["a", "b"] },
  { id: "2v", label: "2 apiladas", slots: 2, cols: "1fr", rows: "1fr 1fr", grid: "'a' 'b'", areas: ["a", "b"] },
  { id: "3mix", label: "1 + 2", slots: 3, cols: "1fr 1fr", rows: "1fr 1fr", grid: "'a a' 'b c'", areas: ["a", "b", "c"] },
  { id: "4grid", label: "2×2", slots: 4, cols: "1fr 1fr", rows: "1fr 1fr", grid: "'a b' 'c d'", areas: ["a", "b", "c", "d"] },
  { id: "6grid", label: "2×3", slots: 6, cols: "1fr 1fr", rows: "1fr 1fr 1fr", grid: "'a b' 'c d' 'e f'", areas: ["a", "b", "c", "d", "e", "f"] },
];

const COLLAGE_GRADIENTS = [
  "linear-gradient(135deg, #FF6B6B, #FF8E7F)",
  "linear-gradient(135deg, #FFB347, #FFC26F)",
  "linear-gradient(135deg, #7C5CFC, #9D7EFE)",
  "linear-gradient(135deg, #3DBBF0, #6DD4FF)",
  "linear-gradient(135deg, #2ECC87, #5DD9A3)",
  "linear-gradient(135deg, #fa709a, #fee140)",
];

function CollagePanel() {
  const [subMode, setSubMode] = useState<"collage" | "tablero">("collage");
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [filledSlots, setFilledSlots] = useState<Record<string, boolean>>({});
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<"yo" | "amigos" | "intimo">("amigos");

  // Tablero creation
  const [tbTitle, setTbTitle] = useState("");
  const [tbCells, setTbCells] = useState<Array<{ label: string; filled: boolean }>>(
    Array.from({ length: 9 }, (_, i) => ({ label: "", filled: false }))
  );

  const layout = COLLAGE_LAYOUTS.find((l) => l.id === selectedLayout);

  const audiences = [
    { key: "yo" as const, label: "Solo yo" },
    { key: "amigos" as const, label: "Amigos" },
    { key: "intimo" as const, label: "Círculo íntimo" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg, paddingLeft: RAIL_GUTTER }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 6px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>
          Crear · {subMode === "collage" ? "Collage" : "Tablero"}
        </div>
      </div>

      {/* Sub-mode toggle: Collage vs Tablero */}
      <div style={{ display: "flex", gap: 6, padding: "4px 18px 10px" }}>
        {(["collage", "tablero"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setSubMode(m)}
            style={{
              padding: "5px 12px", borderRadius: 10,
              border: subMode === m ? "none" : `1px solid ${C.border}`,
              background: subMode === m ? C.primary : "transparent",
              color: subMode === m ? "#fff" : C.textMuted,
              fontSize: 10, fontWeight: 700, cursor: "pointer",
              textTransform: "capitalize",
            }}
          >{m === "collage" ? "Collage" : "Nuevo tablero"}</button>
        ))}
      </div>

      {subMode === "collage" && (
        <div style={{ padding: "0 18px" }}>
          {/* Layout selector */}
          {!selectedLayout && (
            <>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                Elige una composición:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {COLLAGE_LAYOUTS.map((lo) => (
                  <button
                    key={lo.id}
                    onClick={() => setSelectedLayout(lo.id)}
                    style={{
                      aspectRatio: "1", background: C.surface,
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      cursor: "pointer", padding: 4,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 3,
                    }}
                  >
                    <div style={{
                      width: "80%", aspectRatio: "1",
                      display: "grid",
                      gridTemplateColumns: lo.cols,
                      gridTemplateRows: lo.rows,
                      gap: 1.5,
                    }}>
                      {lo.areas.map((_, ai) => (
                        <div key={ai} style={{
                          background: C.surfaceAlt, borderRadius: 2,
                          gridArea: lo.areas[ai],
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 7, color: C.textDim, fontWeight: 600 }}>{lo.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Selected layout — fill slots */}
          {layout && (
            <>
              <button
                onClick={() => { setSelectedLayout(null); setFilledSlots({}); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 10, color: C.textMuted, marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 3,
                }}
              >
                ← Cambiar composición
              </button>
              <div style={{
                display: "grid",
                gridTemplateColumns: layout.cols,
                gridTemplateRows: layout.rows,
                gridTemplateAreas: layout.grid,
                gap: 3,
                borderRadius: 8,
                overflow: "hidden",
                aspectRatio: layout.rows.split(" ").length > 2 ? "2/3" : layout.rows === "1fr" ? "2/1" : "1",
              }}>
                {layout.areas.map((area, ai) => (
                  <button
                    key={area}
                    onClick={() => setFilledSlots((p) => ({ ...p, [area]: !p[area] }))}
                    style={{
                      gridArea: area,
                      background: filledSlots[area] ? COLLAGE_GRADIENTS[ai % COLLAGE_GRADIENTS.length] : C.surfaceAlt,
                      border: filledSlots[area] ? "none" : `2px dashed ${C.border}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      minHeight: 60,
                    }}
                  >
                    {filledSlots[area] ? (
                      <Camera size={20} color="rgba(255,255,255,0.4)" />
                    ) : (
                      <Plus size={20} color={C.textDim} />
                    )}
                  </button>
                ))}
              </div>

              {/* Caption */}
              <input
                type="text"
                placeholder="Añadir pie de foto..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{
                  width: "100%", marginTop: 10, padding: "8px 10px",
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 12, color: C.text, background: C.surface,
                  outline: "none", boxSizing: "border-box",
                }}
              />

              {/* Audience */}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {audiences.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAudience(a.key)}
                    style={{
                      padding: "4px 10px", borderRadius: 8,
                      border: audience === a.key ? "none" : `1px solid ${C.border}`,
                      background: audience === a.key ? C.primary + "22" : "transparent",
                      color: audience === a.key ? C.primary : C.textDim,
                      fontSize: 9, fontWeight: 600, cursor: "pointer",
                    }}
                  >{a.label}</button>
                ))}
              </div>

              {/* Publish button */}
              <button style={{
                width: "100%", marginTop: 12, padding: "10px 0",
                background: C.primary, color: "#fff", border: "none",
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: "pointer",
              }}>
                Publicar collage
              </button>
            </>
          )}
        </div>
      )}

      {subMode === "tablero" && (
        <div style={{ padding: "0 18px" }}>
          {/* Title input */}
          <input
            type="text"
            placeholder="Nombre del tablero..."
            value={tbTitle}
            onChange={(e) => setTbTitle(e.target.value)}
            style={{
              width: "100%", padding: "8px 10px",
              border: `1px solid ${C.border}`, borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: C.text,
              background: C.surface, outline: "none", boxSizing: "border-box",
            }}
          />

          {/* 3×3 grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 4,
            marginTop: 10,
            borderRadius: 8,
            overflow: "hidden",
          }}>
            {tbCells.map((cell, ci) => (
              <button
                key={ci}
                onClick={() => {
                  setTbCells((prev) => prev.map((c, i) =>
                    i === ci ? { ...c, filled: !c.filled, label: c.label || `Celda ${ci + 1}` } : c
                  ));
                }}
                style={{
                  aspectRatio: "1",
                  background: cell.filled ? COLLAGE_GRADIENTS[ci % COLLAGE_GRADIENTS.length] : C.surfaceAlt,
                  border: cell.filled ? "none" : `2px dashed ${C.border}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 2, position: "relative",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: 5,
                  fontSize: 8, fontWeight: 800,
                  color: cell.filled ? "rgba(255,255,255,0.4)" : C.textDim,
                }}>{ci + 1}</span>
                {cell.filled ? (
                  <>
                    <Camera size={16} color="rgba(255,255,255,0.4)" />
                    <span style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                      {cell.label}
                    </span>
                  </>
                ) : (
                  <Plus size={18} color={C.textDim} />
                )}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 10, color: C.textDim, textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
            Cada celda es un apartado de tu proyecto fotográfico
          </p>

          {/* Audience */}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {audiences.map((a) => (
              <button
                key={a.key}
                onClick={() => setAudience(a.key)}
                style={{
                  padding: "4px 10px", borderRadius: 8,
                  border: audience === a.key ? "none" : `1px solid ${C.border}`,
                  background: audience === a.key ? C.primary + "22" : "transparent",
                  color: audience === a.key ? C.primary : C.textDim,
                  fontSize: 9, fontWeight: 600, cursor: "pointer",
                }}
              >{a.label}</button>
            ))}
          </div>

          {/* Publish */}
          <button style={{
            width: "100%", marginTop: 12, padding: "10px 0",
            background: C.primary, color: "#fff", border: "none",
            borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: "pointer",
          }}>
            Publicar tablero
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TOUCH · placeholder sub-views ─────────────────────────────────

const TOUCH_COPY: Record<
  string,
  { title: string; subtitle: string; body: string }
> = {
  album: {
    title: "Touch · Álbum",
    subtitle: "Tu colección personal, sin feed ni algoritmo.",
    body: "Próximamente: grid de tus fotos guardadas con swipe gestures.",
  },
  amigos: {
    title: "Touch · Amigos",
    subtitle: "La red íntima. Solo a quien invitas.",
    body: "Próximamente: lista de personas con las que compartes fotos privadas.",
  },
  collage: {
    title: "Touch · Preparar collage",
    subtitle: "Combina varias fotos en una sola composición.",
    body: "Próximamente: editor de collage con plantillas y arrastrar y soltar.",
  },
  video: {
    title: "Touch · Crear video",
    subtitle: "Vídeos cortos a partir de tus fotos o clips.",
    body: "Próximamente: edición básica, música, transiciones.",
  },
  kiosko: {
    title: "Touch · Ir a tu kiosko",
    subtitle: "Tu escaparate privado. Lo que eliges mostrar.",
    body: "Próximamente: vitrina personal con lo que quieras enseñar al mundo.",
  },
};

function TouchPanel({ kind }: { kind: string }) {
  const copy = TOUCH_COPY[kind] || {
    title: "Touch",
    subtitle: "",
    body: "",
  };
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 320,
          textAlign: "center",
          padding: "28px 22px",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          boxShadow: "0 4px 16px rgba(45,41,38,0.06)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: C.primary + "14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <Lock size={22} color={C.primary} />
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.primary,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {copy.title}
        </div>
        <div
          style={{
            fontSize: 14,
            color: C.text,
            fontWeight: 700,
            lineHeight: 1.35,
            marginBottom: 8,
          }}
        >
          {copy.subtitle}
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textMuted,
            lineHeight: 1.55,
          }}
        >
          {copy.body}
        </div>
      </div>
    </div>
  );
}

// ─── POLIS top-level mode ──────────────────────────────────────────
// Spatial civic layer: a city map where citizens interact via posts
// pinned to places. Migrated from PHAROS' "ágora" + mapa concepts.
// Map rendering is a stylized SVG placeholder until we wire Leaflet.

type PoliPin = {
  id: string;
  title: string;
  body: string;
  author: string;
  catId: string;
  // Position as percent inside the map canvas (0–100) — SVG fallback
  x: number;
  y: number;
  // Real GPS coordinates for Leaflet map
  lat?: number;
  lng?: number;
};

const POLI_PINS: PoliPin[] = [
  {
    id: "p1",
    title: "Bordillo roto en Triana",
    body: "Llevamos 3 semanas avisando al ayuntamiento. Sigue igual.",
    author: "@vecina.triana",
    catId: "urbanismo",
    x: 32,
    y: 38,
    lat: 28.1037,
    lng: -15.4156,
  },
  {
    id: "p2",
    title: "Mercadillo nocturno este sábado",
    body: "Plaza del Pilar, 19h. Productos locales y música en directo.",
    author: "@cultura.lpgc",
    catId: "cultura",
    x: 58,
    y: 28,
    lat: 28.1068,
    lng: -15.4182,
  },
  {
    id: "p3",
    title: "Carril bici hasta El Confital",
    body: "Se aprobó en pleno. Obras empiezan en septiembre.",
    author: "@movilidad.canarias",
    catId: "movilidad",
    x: 72,
    y: 56,
    lat: 28.1481,
    lng: -15.4503,
  },
  {
    id: "p4",
    title: "Limpieza colectiva en Las Canteras",
    body: "Domingo 8h. Trae guantes. Después desayuno comunitario.",
    author: "@las.canteras",
    catId: "comunidad",
    x: 24,
    y: 64,
    lat: 28.135,
    lng: -15.4367,
  },
  {
    id: "p5",
    title: "Asamblea barrio Vegueta",
    body: "Tema único: peatonalización del casco histórico.",
    author: "@vegueta.viva",
    catId: "participacion",
    x: 48,
    y: 72,
    lat: 28.1003,
    lng: -15.4139,
  },
];

const POLIS_MEDAL_COPY: Record<string, { title: string; sub: string }> = {
  mapear: {
    title: "Polis · Mapear la ciudad",
    sub: "Tu ciudad como red social. Toca un pin para leer o suelta uno donde estés.",
  },
  peticionar: {
    title: "Polis · Peticionar punto de interés",
    sub: "Toca un lugar del mapa y firma una petición ciudadana.",
  },
  ocupacion: {
    title: "Polis · Buscar ocupación",
    sub: "Empleo, voluntariado y oficios abiertos cerca de ti.",
  },
  ventanilla: {
    title: "Polis · Ventanilla única",
    sub: "Trámites municipales, directos, sin intermediarios.",
  },
};

function PolisMode({ activeMedal }: { activeMedal: string }) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [openPin, setOpenPin] = useState<PoliPin | null>(null);

  const copy = POLIS_MEDAL_COPY[activeMedal] || POLIS_MEDAL_COPY.mapear;
  const visible = activeCat
    ? POLI_PINS.filter((p) => p.catId === activeCat)
    : POLI_PINS;

  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        paddingLeft: RAIL_GUTTER,
        background: C.bg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          padding: "14px 18px 10px",
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {copy.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          {copy.sub}
        </div>
      </div>

      {/* Category filter chips */}
      <div
        style={{
          padding: "10px 14px",
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          gap: 6,
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setActiveCat(null)}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: `1px solid ${activeCat === null ? C.accent : C.border}`,
            background: activeCat === null ? C.accent + "14" : C.surface,
            color: activeCat === null ? C.accent : C.textMuted,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            fontFamily: "inherit",
          }}
        >
          Todo
        </button>
        {CATEGORIAS.map((c) => {
          const sel = activeCat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(sel ? null : c.id)}
              style={{
                padding: "5px 11px",
                borderRadius: 999,
                border: `1px solid ${sel ? C.accent : C.border}`,
                background: sel ? C.accent + "14" : C.surface,
                color: sel ? C.accent : C.text,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              <span>{c.icono}</span>
              {c.nombre}
            </button>
          );
        })}
      </div>

      {/* Map canvas — Leaflet map for "mapear", SVG fallback otherwise */}
      <div
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {activeMedal === "mapear" ? (
          <PolisMap
            pins={visible}
            landmarks={LANDMARKS}
            activeCat={activeCat}
            onPinClick={(pin) => setOpenPin(openPin?.id === pin.id ? null : pin)}
          />
        ) : (
          /* SVG fallback for non-map medals */
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `
                radial-gradient(circle at 30% 25%, ${C.accent}10 0%, transparent 45%),
                radial-gradient(circle at 70% 70%, ${C.secondary}0c 0%, transparent 50%),
                linear-gradient(135deg, #EEF5F2 0%, #E8EFEC 60%, #DDE7E2 100%)
              `,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.textDim,
              fontSize: 13,
            }}
          >
            {copy.sub}
          </div>
        )}

        {/* Pin detail card overlay */}
        {openPin && (
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 78,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 8px 24px rgba(45,41,38,0.14)",
              maxWidth: 420,
              margin: "0 auto",
              zIndex: 1000,
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: C.accent + "14",
                  color: C.accent,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                }}
              >
                {CATEGORIAS.find((c) => c.id === openPin.catId)?.icono}{" "}
                {CATEGORIAS.find((c) => c.id === openPin.catId)?.nombre}
              </span>
              <button
                onClick={() => setOpenPin(null)}
                aria-label="Cerrar"
                style={{
                  background: "none",
                  border: "none",
                  color: C.textDim,
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: C.text,
                lineHeight: 1.35,
                marginBottom: 4,
              }}
            >
              {openPin.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.textMuted,
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              {openPin.body}
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.textDim,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{openPin.author}</span>
              <span>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Heart size={11} /> 12
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <MessageCircle size={11} /> 4
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compose anchored to current location */}
      <div
        style={{
          padding: "10px 14px 12px",
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 10px",
            borderRadius: 999,
            background: C.accent + "14",
            color: C.accent,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.3,
            flexShrink: 0,
          }}
        >
          <MapPin size={11} /> Aquí
        </div>
        <div
          style={{
            flex: 1,
            padding: "9px 14px",
            background: C.surfaceAlt,
            borderRadius: 22,
            fontSize: 12,
            color: C.textDim,
            border: `1px solid ${C.border}`,
          }}
        >
          Suelta una idea en este punto del mapa…
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: C.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Send size={15} color="#fff" />
        </div>
      </div>
    </div>
  );
}

function AhoraPanel() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: C.bg,
        paddingLeft: RAIL_GUTTER,
      }}
    >
      <div style={{ padding: "16px 18px 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Ahora · Mapa cívico
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textDim,
            marginTop: 2,
          }}
        >
          Lo que pasa cerca de ti. En tu isla, en tu barrio.
        </div>
      </div>
      <div style={{ padding: "12px 14px 24px" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${C.accent}14, ${C.secondary}10)`,
            border: `1px solid ${C.accent}33`,
            borderRadius: 14,
            padding: "26px 18px",
            textAlign: "center",
          }}
        >
          <MapPin
            size={28}
            color={C.accent}
            style={{ marginBottom: 8 }}
          />
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: C.text,
              marginBottom: 6,
            }}
          >
            El mapa vive en PHAROS
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.textMuted,
              lineHeight: 1.5,
              maxWidth: 280,
              margin: "0 auto",
            }}
          >
            Estamos integrando Leaflet directamente aquí. Mientras tanto
            puedes explorarlo en la versión PHAROS.
          </div>
          <a
            href="http://localhost:3001/mapa"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 14,
              padding: "8px 14px",
              background: C.accent,
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Abrir mapa <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Report Modal ─────────────────────────────────────────────────── */

const REPORT_REASONS = ["Spam", "Acoso", "Odio", "Desinformación", "Otro"] as const;

function ReportModal({
  target,
  onClose,
  onSubmit,
}: {
  target: { postId: string; commentId?: string };
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <h3
          style={{
            margin: "0 0 18px",
            fontSize: 17,
            fontWeight: 700,
            color: C.text,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          Reportar contenido
        </h3>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: `1.5px solid ${reason === r ? C.primary : C.border}`,
                background: reason === r ? C.primary : C.surfaceAlt,
                color: reason === r ? "#fff" : C.text,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <textarea
          placeholder="Detalles adicionales..."
          maxLength={300}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          style={{
            width: "100%",
            minHeight: 70,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: 12,
            fontSize: 13,
            color: C.text,
            background: C.surfaceAlt,
            resize: "vertical",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            boxSizing: "border-box",
          }}
        />
        <div style={{ fontSize: 11, color: C.textDim, textAlign: "right", marginTop: 4 }}>
          {details.length}/300
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surfaceAlt,
              color: C.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Cancelar
          </button>
          <button
            disabled={!reason}
            onClick={() => {
              if (reason) {
                onSubmit(reason, details);
                onClose();
              }
            }}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              background: reason ? C.primary : C.border,
              color: reason ? "#fff" : C.textDim,
              fontSize: 13,
              fontWeight: 600,
              cursor: reason ? "pointer" : "not-allowed",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              transition: "all .15s",
            }}
          >
            Enviar reporte
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications system ────────────────────────────────────────────
type Notif = {
  id: string;
  kind: "pec" | "comment" | "follow" | "mention" | "report" | "system";
  text: string;
  time: string;
  read: boolean;
  avatar?: string;
  avatarColor?: string;
  linkPostId?: string;
};

const NOTIF_ICONS: Record<Notif["kind"], { icon: string; color: string }> = {
  pec: { icon: "👤", color: C.secondary },
  comment: { icon: "💬", color: C.secondary },
  follow: { icon: "🤝", color: C.accent },
  mention: { icon: "@", color: C.primary },
  report: { icon: "🚩", color: C.semRed },
  system: { icon: "⚙️", color: C.textDim },
};

const INITIAL_NOTIFS: Notif[] = [
  { id: "n1", kind: "pec", text: "marina.dev hizo PEC en tu post sobre diseño", time: "hace 3m", read: false, avatar: "M", avatarColor: "#3DBBF0" },
  { id: "n2", kind: "comment", text: "carlos.ui respondió: \"Totalmente de acuerdo\"", time: "hace 12m", read: false, avatar: "C", avatarColor: "#9B8BF4" },
  { id: "n3", kind: "follow", text: "ana.nature empezó a seguirte", time: "hace 1h", read: false, avatar: "A", avatarColor: "#2ECC87" },
  { id: "n4", kind: "mention", text: "panxo93 te mencionó en un comentario", time: "hace 2h", read: true, avatar: "P", avatarColor: "#FF6B6B" },
  { id: "n5", kind: "system", text: "Tu reporte sobre spam fue resuelto", time: "hace 5h", read: true },
  { id: "n6", kind: "pec", text: "3 personas hicieron PEC en tu cita de Sócrates", time: "ayer", read: true },
  { id: "n7", kind: "comment", text: "marco.aurelio respondió a tu hilo", time: "ayer", read: true, avatar: "MA", avatarColor: "#D4AF37" },
];

export default function FeedPage() {
  const [mode, setMode] = useState<"touch" | "feed" | "polis">("feed");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [peced, setPeced] = useState<Record<string, boolean>>({});

  // Yapper = personajes históricos hablando (IA con contenido cultural).
  // Toggle para incluir o filtrar esos posts del timeline de Amigos.
  const [yapperOn, setYapperOn] = useState<boolean>(true);

  // Comments per post (flat list; tree is computed by parentId).
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);

  // When non-null, CommentThread modal is shown for the given post.
  const [threadPostId, setThreadPostId] = useState<string | null>(null);

  // Report moderation
  const [reportModal, setReportModal] = useState<{ postId: string; commentId?: string } | null>(null);
  const [reports, setReports] = useState<Array<{ postId: string; commentId?: string; reason: string; details: string; time: string }>>([]);

  // Profile FAB (bottom-right)
  const [profileOpen, setProfileOpen] = useState(false);
  const [mySem, setMySem] = useState<"green" | "yellow" | "red">("green");

  // Notifications
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const [notiPanel, setNotiPanel] = useState(false);
  const unreadCount = notifs.filter((n) => !n.read).length;
  const markAllRead = () =>
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) =>
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  const addComment = (postId: string, parentId: string | null, text: string) => {
    setComments((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        postId,
        parentId,
        author: "tu",
        avatarColor: C.primary,
        text,
        time: "ahora",
        likes: 0,
      },
    ]);
  };

  // Counts of comments per post (for the MessageCircle badge)
  const commentCountByPost = comments.reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.postId] = (acc[c.postId] || 0) + 1;
      return acc;
    },
    {}
  );

  // Rail medals depend on mode. activeMedal resets when switching mode so
  // the rail always opens on the first verb of that context.
  const railMedals = medalsFor(mode);
  const railAccent =
    mode === "touch" ? C.primary : mode === "polis" ? C.accent : C.secondary;
  const [activeMedal, setActiveMedal] = useState<string>(railMedals[0].key);
  useEffect(() => {
    setActiveMedal(medalsFor(mode)[0].key);
  }, [mode]);

  const [diaryOpen, setDiaryOpen] = useState(false);
  // Diario inicial. El usuario lo puede editar en el panel y los cambios se
  // persisten en localStorage (ver useEffect más abajo). Para baked-in
  // permanente hay que editar esta constante o pedirme "guarda el diario".
  const [lists, setLists] = useState<Checklist[]>([
    {
      id: "l1",
      title: "Hoy",
      items: [
        { id: "i1", text: "Revisar diseño del feed", done: false },
        { id: "i2", text: "Probar flujo de email", done: false },
      ],
    },
    {
      id: "l2",
      title: "Prototipo",
      items: [
        {
          id: "i-yapper",
          text: "Base de datos de personajes Yapper",
          done: false,
        },
        { id: "i3", text: "Cerrar pantalla de registro", done: false },
        { id: "i4", text: "Conectar Supabase prod", done: false },
      ],
    },
    {
      id: "l3",
      title: "Lanzar a 500 personas",
      items: [
        // Fase 0 — Fundamentos
        { id: "l5-01", text: "1. Repo + CI/CD en Vercel con preview por PR", done: false },
        { id: "l5-02", text: "2. Proyecto Supabase de producción separado de dev", done: false },
        { id: "l5-03", text: "3. Dominio propio + HTTPS + redirects", done: false },
        { id: "l5-04", text: "4. Variables de entorno rotadas (.env.production en Vercel)", done: false },
        { id: "l5-05", text: "5. Email transaccional con dominio verificado (Resend o Postmark)", done: false },
        // Fase 1 — Modelo y auth
        { id: "l5-06", text: "6. Esquema Supabase: users, profiles, posts, comments, pecs, follows, albums, media, citas, yappers", done: false },
        { id: "l5-07", text: "7. Row Level Security en cada tabla (policies read/write)", done: false },
        { id: "l5-08", text: "8. Migraciones versionadas en repo (supabase/migrations)", done: false },
        { id: "l5-09", text: "9. Auth: magic link + Google OAuth", done: false },
        { id: "l5-10", text: "10. Onboarding mínimo obligatorio (handle, avatar, bio, intereses)", done: false },
        // Fase 2 — Core del producto
        { id: "l5-11", text: "11. FEED Amigos con comentarios persistidos + PEC real", done: false },
        { id: "l5-12", text: "12. Algoritmo con pesos por sección + vetos", done: false },
        { id: "l5-13", text: "13. Touch Álbum con subida real a Supabase Storage", done: false },
        { id: "l5-14", text: "14. POLIS mapa con Leaflet + pins persistidos por coordenadas", done: false },
        { id: "l5-15", text: "15. Moderación: botón reportar + cola de revisión + shadow ban", done: false },
        { id: "l5-16", text: "16. Términos, privacidad y política de cookies publicados", done: false },
        // Fase 3 — Calidad de servicio
        { id: "l5-17", text: "17. Rate limiting (edge function por IP y por usuario)", done: false },
        { id: "l5-18", text: "18. CDN e imágenes optimizadas (Supabase Storage transformaciones)", done: false },
        { id: "l5-19", text: "19. Error tracking con Sentry", done: false },
        { id: "l5-20", text: "20. Product analytics (PostHog o Plausible)", done: false },
        { id: "l5-21", text: "21. Backups diarios automáticos de Supabase", done: false },
        // Fase 4 — Confianza y comunidad
        { id: "l5-22", text: "22. Onboarding guiado de 3-4 pantallas", done: false },
        { id: "l5-23", text: "23. Email de bienvenida + FAQ + página de soporte", done: false },
        { id: "l5-24", text: "24. Canal de feedback (form, Discord o email)", done: false },
        { id: "l5-25", text: "25. Status page mínima (UptimeRobot)", done: false },
        // Fase 5 — Escala controlada
        { id: "l5-26", text: "26. Hard cap de 500 usuarios en el código + waitlist", done: false },
        { id: "l5-27", text: "27. Códigos de invitación para medir crecimiento", done: false },
        { id: "l5-28", text: "28. Dimensionar plan Supabase/Vercel para 500 usuarios concurrentes", done: false },
        { id: "l5-29", text: "29. Dashboard interno para ver cuentas, posts y uso", done: false },
        // Fase 6 — Pre-lanzamiento
        { id: "l5-30", text: "30. QA manual de recorridos críticos (registro, publicar, PEC, comentar)", done: false },
        { id: "l5-31", text: "31. Pruebas de carga con k6 (500 usuarios concurrentes)", done: false },
        { id: "l5-32", text: "32. Guión de respuesta para incidencias comunes", done: false },
        { id: "l5-33", text: "33. Landing + formulario de waitlist público", done: false },
        // Fase 7 — Lanzamiento
        { id: "l5-34", text: "34. Soft launch a 50 invitados de confianza", done: false },
        { id: "l5-35", text: "35. Iteración rápida primera semana (bugs críticos)", done: false },
        { id: "l5-36", text: "36. Ampliación gradual hasta 500", done: false },
      ],
    },
    {
      id: "l4",
      title: "Categorías Lighthouse (decisiones)",
      items: [
        // Decisiones tomadas sobre las categorías del prototipo original.
        { id: "lh-01", text: "Ágora → Feed de POLIS (debates vecinales dentro del modo POLIS)", done: false },
        { id: "lh-02", text: "Galería — Descartada (no aplica)", done: true },
        { id: "lh-03", text: "Puente (Empleo) — Descartada (no aplica)", done: true },
        { id: "lh-04", text: "Buscar — Buscador global entre toggle de modos y ⚙️ ajustes", done: false },
        { id: "lh-05", text: "Mapear → Es POLIS: mapa gamificado + reportes de desperfectos urbanos", done: false },
        { id: "lh-06", text: "Alertas — Sistema de notificaciones (diseñar e implementar)", done: false },
        { id: "lh-07", text: "Perfil — Ya existe, profundizar (página pública, editar, estadísticas)", done: false },
      ],
    },
  ]);

  // Persistencia del diario en localStorage. Los cambios del panel sobreviven
  // a recargas de página en el navegador del usuario. NO se sincronizan con
  // el source code — para que algo se "baje" al .tsx, hay que editar el
  // estado inicial de arriba manualmente o pedirme "guarda el diario en el
  // jsx" y yo lo vuelco como initial state en el source.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("KOINOS:diary:lists:v1");
      if (raw) {
        const parsed = JSON.parse(raw) as Checklist[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLists(parsed);
        }
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "KOINOS:diary:lists:v1",
        JSON.stringify(lists)
      );
    } catch {
      /* quota / private mode */
    }
  }, [lists]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const addItem = (listId: string) => {
    const text = (drafts[listId] || "").trim();
    if (!text) return;
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: [
                ...l.items,
                { id: `i${Date.now()}`, text, done: false },
              ],
            }
          : l
      )
    );
    setDrafts((p) => ({ ...p, [listId]: "" }));
  };

  const toggleItem = (listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((it) =>
                it.id === itemId ? { ...it, done: true } : it
              ),
            }
          : l
      )
    );
    setTimeout(() => {
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? { ...l, items: l.items.filter((it) => it.id !== itemId) }
            : l
        )
      );
    }, 350);
  };

  const addList = () => {
    setLists((p) => [
      ...p,
      { id: `l${Date.now()}`, title: "Nueva lista", items: [] },
    ]);
  };

  const renameList = (listId: string, title: string) => {
    setLists((p) => p.map((l) => (l.id === listId ? { ...l, title } : l)));
  };

  const deleteList = (listId: string) => {
    setLists((p) => p.filter((l) => l.id !== listId));
  };

  return (
    <div
      style={{
        height: "100dvh",
        background: C.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: C.text,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* Centered main area */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Adventure medals — floating vertical rail on the left.
            Medals change based on the active top-level mode. */}
        <FloatingRail
          medals={railMedals}
          active={activeMedal}
          onSelect={setActiveMedal}
          accent={railAccent}
        />

        {/* Settings cog — floats in the gap on the right side */}
        <button
          aria-label="Preferencias"
          title="Preferencias"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(45,41,38,0.06)",
            zIndex: 30,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = C.secondary;
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              C.secondary + "55";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = C.textMuted;
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              C.border;
          }}
        >
          <Settings size={16} />
        </button>

        <div
          style={{
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            borderLeft: `1px solid ${C.border}`,
            borderRight: `1px solid ${C.border}`,
            background: C.bg,
            position: "relative",
          }}
        >
          {/* Folded page corner — Diario trigger */}
          {!diaryOpen && (
            <button
              onClick={() => setDiaryOpen(true)}
              aria-label="Abrir diario"
              title="Diario"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 60,
                height: 60,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                zIndex: 40,
              }}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                style={{
                  display: "block",
                  filter: "drop-shadow(-3px 3px 4px rgba(45,41,38,0.12))",
                }}
              >
                <defs>
                  <linearGradient
                    id="paperFold"
                    x1="100%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="55%" stopColor={C.surfaceAlt} />
                    <stop offset="100%" stopColor={C.border} />
                  </linearGradient>
                </defs>
                <path d="M 60 0 L 0 0 L 60 60 Z" fill="url(#paperFold)" />
                <path
                  d="M 0 0 L 60 60"
                  stroke={C.textDim}
                  strokeWidth="0.6"
                  opacity="0.55"
                />
              </svg>
              <span
                style={{
                  position: "absolute",
                  top: 9,
                  right: 9,
                  fontSize: 8,
                  fontWeight: 800,
                  color: C.secondary,
                  letterSpacing: 0.6,
                  transform: "rotate(45deg)",
                  pointerEvents: "none",
                }}
              >
                DIARIO
              </span>
            </button>
          )}

          {/* Header — logo left, mode toggle centered */}
          <div
            style={{
              padding: "14px 70px 10px 18px",
              display: "flex",
              alignItems: "center",
              borderBottom: `1px solid ${C.border}`,
              background: C.surface,
              flexShrink: 0,
              position: "relative",
            }}
          >
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                }}
              >
                <span style={{ color: C.primary }}>K</span>
                <span style={{ color: C.text }}>OINOS</span>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                background: C.surfaceAlt,
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <button
                onClick={() => setMode("touch")}
                style={{
                  padding: "5px 9px",
                  border: "none",
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: "pointer",
                  background: mode === "touch" ? C.primary : "transparent",
                  color: mode === "touch" ? "#fff" : C.textMuted,
                  borderRadius: mode === "touch" ? 10 : 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.2s",
                }}
              >
                <Lock size={9} /> TOUCH
              </button>
              <button
                onClick={() => setMode("feed")}
                style={{
                  padding: "5px 9px",
                  border: "none",
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: "pointer",
                  background: mode === "feed" ? C.secondary : "transparent",
                  color: mode === "feed" ? "#fff" : C.textMuted,
                  borderRadius: mode === "feed" ? 10 : 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.2s",
                }}
              >
                <Globe size={9} /> FEED
              </button>
              <button
                onClick={() => setMode("polis")}
                style={{
                  padding: "5px 9px",
                  border: "none",
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: "pointer",
                  background: mode === "polis" ? C.accent : "transparent",
                  color: mode === "polis" ? "#fff" : C.textMuted,
                  borderRadius: mode === "polis" ? 10 : 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.2s",
                }}
              >
                <Landmark size={9} /> POLIS
              </button>
            </div>
            <div style={{ flex: 1 }} />
          </div>

          {mode === "polis" && (
            <PolisMode activeMedal={activeMedal} />
          )}

          {mode === "feed" && activeMedal === "noticias" && <NoticiaPanel />}
          {mode === "feed" && activeMedal === "escribir" && <EscribirPanel />}
          {mode === "feed" && activeMedal === "algoritmo" && <AlgoritmoPanel />}

          {mode === "touch" && activeMedal === "album" && <AlbumPanel />}
          {mode === "touch" && activeMedal === "amigos" && <AmigosPanel />}
          {mode === "touch" && activeMedal === "tableros" && <TablerosPanel />}
          {mode === "touch" && activeMedal === "collage" && <CollagePanel />}
          {mode === "touch" && activeMedal === "video" && <TouchPanel kind="video" />}
          {mode === "touch" && activeMedal === "kiosko" && <TouchPanel kind="kiosko" />}

          {mode === "feed" && activeMedal === "amigos" ? (
            <>
              {/* Timeline */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingLeft: RAIL_GUTTER,
                }}
              >
                <div
                  style={{
                    padding: "14px 18px 10px",
                    background: C.bg,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: C.textMuted,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    Amigos · Tu red
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textDim,
                      marginTop: 2,
                    }}
                  >
                    Ideas de la gente que sigues. Red abierta,
                    interacción separada.
                  </div>

                  {/* Yapper toggle */}
                  <button
                    onClick={() => setYapperOn((v) => !v)}
                    aria-pressed={yapperOn}
                    aria-label="Alternar Yapper"
                    style={{
                      marginTop: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px 5px 6px",
                      background: yapperOn ? C.gold + "18" : C.surface,
                      border: `1px solid ${yapperOn ? C.gold + "66" : C.border}`,
                      borderRadius: 20,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: yapperOn ? C.gold : C.surfaceAlt,
                        color: yapperOn ? "#fff" : C.textDim,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      <Sparkles size={11} />
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        color: yapperOn ? C.gold : C.textMuted,
                        textTransform: "uppercase",
                      }}
                    >
                      Yapper {yapperOn ? "on" : "off"}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: C.textDim,
                        fontWeight: 600,
                        marginLeft: 2,
                      }}
                    >
                      personajes históricos
                    </span>
                  </button>
                </div>
                {POSTS.filter(
                  (post) =>
                    yapperOn || skinOf(post).id !== "yapper"
                ).map((post, i) => {
                  const key = `f${i}`;
                  const isLiked = liked[key];
                  const isPeced = peced[key];
                  const skin = skinOf(post);
                  return (
                    <div
                      key={post.id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        background: skin.bg,
                        borderLeft: `3px solid ${skin.accent}`,
                        padding: "14px 18px",
                        fontFamily: skin.fontFamily,
                      }}
                    >
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: post.avatarColor + "22",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: 14,
                              color: post.avatarColor,
                              border: `2px solid ${post.avatarColor}55`,
                              fontFamily:
                                "-apple-system, BlinkMacSystemFont, sans-serif",
                            }}
                          >
                            {post.avatar}
                          </div>
                          {post.sem && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: -1,
                                right: -1,
                              }}
                            >
                              <SemaforoDot status={post.sem} size={10} />
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color:
                                  skin.id === "plain" ? C.text : skin.accent,
                                fontFamily:
                                  "-apple-system, BlinkMacSystemFont, sans-serif",
                              }}
                            >
                              @{post.user}
                            </span>
                            {skin.badge && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: "2px 7px",
                                  background: skin.accent + "1c",
                                  border: `1px solid ${skin.accent}55`,
                                  borderRadius: 8,
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: skin.accent,
                                  letterSpacing: 0.5,
                                  fontFamily:
                                    "-apple-system, BlinkMacSystemFont, sans-serif",
                                }}
                              >
                                {skin.badge.icon === "sparkles" && (
                                  <Sparkles size={9} />
                                )}
                                {skin.badge.label}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 11,
                                color: C.textDim,
                                marginLeft: "auto",
                                fontFamily:
                                  "-apple-system, BlinkMacSystemFont, sans-serif",
                              }}
                            >
                              {post.time}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: skin.textSize,
                              color: C.text,
                              lineHeight: 1.55,
                              marginBottom: 10,
                              fontStyle: skin.fontStyle,
                              fontFamily: skin.fontFamily,
                            }}
                          >
                            {post.text}
                          </div>
                          {post.image && (
                            <div
                              style={{
                                borderRadius: 14,
                                overflow: "hidden",
                                marginBottom: 10,
                                border: `1px solid ${C.border}`,
                                maxHeight: 320,
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={post.image}
                                alt={post.user}
                                style={{
                                  width: "100%",
                                  display: "block",
                                  objectFit: "cover",
                                }}
                              />
                            </div>
                          )}
                          {skin.badge && post.aiLabel && (
                            <div
                              style={{
                                fontSize: 11,
                                color: skin.accent,
                                fontWeight: 600,
                                marginBottom: 10,
                                letterSpacing: 0.3,
                                fontFamily: skin.fontFamily,
                                fontStyle: skin.fontStyle,
                              }}
                            >
                              — {post.aiLabel}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: 14,
                              alignItems: "center",
                              fontFamily:
                                "-apple-system, BlinkMacSystemFont, sans-serif",
                            }}
                          >
                            <button
                              onClick={() =>
                                setLiked((p) => ({ ...p, [key]: !p[key] }))
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              <Heart
                                size={15}
                                color={isLiked ? C.primary : C.textDim}
                                fill={isLiked ? C.primary : "none"}
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: isLiked ? C.primary : C.textDim,
                                }}
                              >
                                {post.likes + (isLiked ? 1 : 0)}
                              </span>
                            </button>
                            <PecStack
                              post={post}
                              pressed={isPeced}
                              onToggle={() =>
                                setPeced((p) => ({ ...p, [key]: !p[key] }))
                              }
                            />
                            <button
                              onClick={() => setThreadPostId(post.id)}
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              aria-label="Abrir hilo de comentarios"
                            >
                              <MessageCircle size={15} color={C.textDim} />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: C.textDim,
                                }}
                              >
                                {commentCountByPost[post.id] || 0}
                              </span>
                            </button>
                            <button
                              onClick={() => setReportModal({ postId: post.id })}
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                alignItems: "center",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                opacity: 0.5,
                              }}
                              aria-label="Reportar publicación"
                            >
                              <Flag size={13} color={C.textDim} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compose */}
              <div
                style={{
                  padding: `12px 18px 12px ${RAIL_GUTTER + 4}px`,
                  background: C.surface,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderTop: `1px solid ${C.border}`,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: C.surfaceAlt,
                    borderRadius: 22,
                    fontSize: 13,
                    color: C.textDim,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  Comparte algo con el mundo...
                </div>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: C.secondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Send size={16} color="#fff" />
                </div>
              </div>
            </>
          ) : null}

        </div>
      </div>

      {/* Diario panel — slides in from right */}
      <div
        style={{
          width: diaryOpen ? 340 : 0,
          flexShrink: 0,
          background: C.surface,
          borderLeft: diaryOpen ? `1px solid ${C.border}` : "none",
          overflow: "hidden",
          transition: "width 0.3s ease",
          display: "flex",
          flexDirection: "column",
          boxShadow: diaryOpen ? "-8px 0 24px rgba(45,41,38,0.06)" : "none",
        }}
      >
        <div
          style={{
            padding: "16px 18px 12px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: C.text,
                letterSpacing: 0.4,
                fontFamily: "Georgia, serif",
              }}
            >
              Diario
            </span>
            <span
              style={{
                fontSize: 10,
                color: C.textDim,
                fontWeight: 600,
              }}
            >
              {lists.length} {lists.length === 1 ? "lista" : "listas"}
            </span>
          </div>
          <button
            onClick={() => setDiaryOpen(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.textDim,
              padding: 4,
              display: "flex",
            }}
            aria-label="Cerrar diario"
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px 24px",
          }}
        >
          {lists.map((list) => (
            <div key={list.id} style={{ marginBottom: 22 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <input
                  value={list.title}
                  onChange={(e) => renameList(list.id, e.target.value)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 800,
                    color: C.text,
                    padding: "4px 0",
                    outline: "none",
                    letterSpacing: 0.2,
                  }}
                />
                <button
                  onClick={() => deleteList(list.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.textDim,
                    cursor: "pointer",
                    padding: 2,
                    display: "flex",
                    opacity: 0.5,
                  }}
                  title="Eliminar lista"
                >
                  <X size={12} />
                </button>
              </div>
              <div
                style={{
                  height: 1,
                  background: C.border,
                  marginBottom: 4,
                }}
              />
              {list.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 9,
                    padding: "6px 2px",
                    opacity: item.done ? 0 : 1,
                    transform: item.done
                      ? "translateX(20px)"
                      : "translateX(0)",
                    transition: "all 0.35s",
                  }}
                >
                  <button
                    onClick={() => toggleItem(list.id, item.id)}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: `1.5px solid ${C.textDim}`,
                      background: "transparent",
                      cursor: "pointer",
                      flexShrink: 0,
                      marginTop: 3,
                      padding: 0,
                    }}
                    aria-label="Completar"
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: C.text,
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "4px 2px",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: `1.5px dashed ${C.border}`,
                    flexShrink: 0,
                    marginTop: 3,
                  }}
                />
                <input
                  value={drafts[list.id] || ""}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [list.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addItem(list.id);
                  }}
                  placeholder="añadir línea..."
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    fontSize: 13,
                    color: C.text,
                    padding: "4px 0",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          ))}

          <button
            onClick={addList}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1.5px dashed ${C.border}`,
              background: "transparent",
              color: C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 8,
              transition: "all 0.2s",
            }}
          >
            <Plus size={13} /> Nueva lista
          </button>
        </div>
      </div>

      {/* ─── Profile FAB · bottom-right ──────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        {/* Profile popover — expands upward */}
        {profileOpen && (
          <div
            style={{
              width: 220,
              background: C.surface,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              boxShadow: "0 8px 32px rgba(45,41,38,0.14)",
              padding: "16px 14px",
              marginBottom: 4,
              animation: "fadeUp 0.18s ease-out",
            }}
          >
            {/* User card */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: C.primary + "22",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 14,
                  color: C.primary,
                  border: `2px solid ${C.primary}55`,
                  position: "relative",
                }}
              >
                YO
                <div style={{ position: "absolute", bottom: -2, right: -2 }}>
                  <SemaforoDot status={mySem} size={10} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>@tu_handle</div>
                <div style={{ fontSize: 11, color: C.textDim }}>Mi perfil</div>
              </div>
            </div>

            {/* Semáforo selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>
                Estado
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["green", "yellow", "red"] as const).map((s) => {
                  const labels = { green: "Abierto", yellow: "Selectivo", red: "Cerrado" };
                  const colors = { green: C.semGreen, yellow: C.semYellow, red: C.semRed };
                  return (
                    <button
                      key={s}
                      onClick={() => setMySem(s)}
                      style={{
                        flex: 1,
                        padding: "5px 0",
                        borderRadius: 8,
                        border: `1.5px solid ${mySem === s ? colors[s] : C.border}`,
                        background: mySem === s ? colors[s] + "18" : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[s] }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: mySem === s ? colors[s] : C.textDim }}>
                        {labels[s]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12, padding: "8px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>24</div>
                <div style={{ fontSize: 9, color: C.textDim }}>Posts</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>83</div>
                <div style={{ fontSize: 9, color: C.textDim }}>PECs</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>12</div>
                <div style={{ fontSize: 9, color: C.textDim }}>Amigos</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: C.text, fontWeight: 500, width: "100%" }}>
                <Eye size={14} color={C.textDim} /> Ver mi perfil
              </button>
              <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: C.text, fontWeight: 500, width: "100%" }}>
                <Settings size={14} color={C.textDim} /> Preferencias
              </button>
              <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: C.semRed, fontWeight: 500, width: "100%" }}>
                <LogOut size={14} color={C.semRed} /> Cerrar sesión
              </button>
            </div>
          </div>
        )}

        {/* Avatar FAB button */}
        <button
          onClick={() => { setProfileOpen((v) => !v); if (notiPanel) setNotiPanel(false); }}
          aria-label="Tu perfil"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: profileOpen ? C.primary : C.surface,
            border: `2px solid ${profileOpen ? C.primary : C.border}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 15,
            color: profileOpen ? "#fff" : C.primary,
            boxShadow: "0 4px 16px rgba(45,41,38,0.12)",
            transition: "all 0.2s",
            position: "relative",
          }}
        >
          {profileOpen ? <ChevronUp size={18} /> : "YO"}
          <div style={{ position: "absolute", bottom: -1, right: -1 }}>
            <SemaforoDot status={mySem} size={12} />
          </div>
        </button>
      </div>

      {/* ─── Notification bell · top-right next to settings ──────── */}
      <button
        onClick={() => { setNotiPanel((v) => !v); if (profileOpen) setProfileOpen(false); }}
        aria-label="Notificaciones"
        style={{
          position: "absolute",
          top: 18,
          right: 56,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: notiPanel ? C.secondary + "18" : C.surface,
          border: `1px solid ${notiPanel ? C.secondary + "55" : C.border}`,
          color: notiPanel ? C.secondary : C.textMuted,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(45,41,38,0.06)",
          zIndex: 31,
          transition: "all 0.2s",
        }}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: C.primary,
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `2px solid ${C.surface}`,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel — slides from top-right */}
      {notiPanel && (
        <div
          style={{
            position: "absolute",
            top: 58,
            right: 18,
            width: 300,
            maxHeight: 420,
            background: C.surface,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            boxShadow: "0 8px 32px rgba(45,41,38,0.14)",
            zIndex: 50,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: C.secondary,
                  fontWeight: 600,
                }}
              >
                Marcar todo leído
              </button>
            )}
          </div>
          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifs.map((n) => {
              const meta = NOTIF_ICONS[n.kind];
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 14px",
                    background: n.read ? "transparent" : C.secondary + "08",
                    border: "none",
                    borderBottom: `1px solid ${C.border}`,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Avatar or icon */}
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: n.avatarColor ? n.avatarColor + "22" : meta.color + "18",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: n.avatar ? 11 : 13,
                      fontWeight: 800,
                      color: n.avatarColor || meta.color,
                      flexShrink: 0,
                    }}
                  >
                    {n.avatar || meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.text,
                        lineHeight: 1.4,
                        fontWeight: n.read ? 400 : 600,
                      }}
                    >
                      {n.text}
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                      {n.time}
                    </div>
                  </div>
                  {!n.read && (
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: C.secondary,
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Comment thread modal — reddit-twitter style branching threads.
          Renders on top of the feed when a MessageCircle is tapped. */}
      {threadPostId &&
        (() => {
          const threadPost = POSTS.find((p) => p.id === threadPostId);
          if (!threadPost) return null;
          return (
            <CommentThread
              post={threadPost}
              comments={comments.filter((c) => c.postId === threadPostId)}
              onClose={() => setThreadPostId(null)}
              onAddComment={(parentId, text) =>
                addComment(threadPostId, parentId, text)
              }
            />
          );
        })()}

      {/* Report Modal */}
      {reportModal && (
        <ReportModal
          target={reportModal}
          onClose={() => setReportModal(null)}
          onSubmit={(reason, details) => {
            setReports((prev) => [
              ...prev,
              {
                postId: reportModal.postId,
                commentId: reportModal.commentId,
                reason,
                details,
                time: new Date().toISOString(),
              },
            ]);
          }}
        />
      )}
    </div>
  );
}
