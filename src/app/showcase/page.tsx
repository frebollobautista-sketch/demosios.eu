"use client";

import { useState, useRef } from "react";
import { Camera, MessageCircle, Heart, Bell, Search, Home, User, Zap, Globe, Bookmark, ChevronLeft, ChevronRight, Image, Send, Lock, Unlock, Users, Rss, ExternalLink, Mic, Eye, MapPin, Upload, X } from "lucide-react";

const C = {
  bg: "#FAF7F5", surface: "#FFFFFF", surfaceAlt: "#F3EFEC", card: "#FFFFFF",
  border: "#E8E2DD", primary: "#FF6B6B", primaryLight: "#FF8A8A", secondary: "#7C5CFC",
  accent: "#3DBBF0", success: "#2ECC87", warning: "#FFB347", text: "#2D2926",
  textMuted: "#7A7067", textDim: "#A89F97",
  shadow: "0 2px 16px rgba(45,41,38,0.06)", shadowLift: "0 8px 32px rgba(45,41,38,0.10)",
  semGreen: "#2ECC87", semYellow: "#FFB347", semRed: "#FF6B6B",
};

const TOUCH_POSTS = [
  { grad: "linear-gradient(135deg, #667eea, #764ba2)", label: "Santorini al atardecer", user: "pablo.foto", avatar: "P", avatarColor: "#667eea",
    text: "Hay lugares que no necesitan filtro. Santorini al atardecer es uno de ellos.",
    qualitative: "Le gusto a mucha gente", pecUsers: ["M","A","L"], pecExtra: 4 },
  { grad: "linear-gradient(135deg, #f093fb, #f5576c)", label: "Amanecer en el Teide", user: "marina.travel", avatar: "M", avatarColor: "#f093fb",
    text: "A las 5AM no quieres estar despierta. Pero cuando ves esto, entiendes por que.",
    qualitative: "Le encanto a bastantes", pecUsers: ["C","P"], pecExtra: 9 },
  { grad: "linear-gradient(135deg, #4facfe, #00f2fe)", label: "Playa de cristal, Okinawa", user: "carlos.world", avatar: "C", avatarColor: "#4facfe",
    text: "El agua es tan transparente que parece que las piedras flotan. No es Photoshop.",
    qualitative: "Le gusto a algunos", pecUsers: ["A"], pecExtra: 1 },
  { grad: "linear-gradient(135deg, #43e97b, #38f9d7)", label: "Selva de Borneo", user: "ana.nature", avatar: "A", avatarColor: "#43e97b",
    text: "Tres dias caminando. Sin senal, sin WiFi, sin prisa. La selva te ensena a escuchar.",
    qualitative: "Le gusto a mucha gente", pecUsers: ["P","M","C","L"], pecExtra: 12 },
  { grad: "linear-gradient(135deg, #fa709a, #fee140)", label: "Mercado nocturno Bangkok", user: "lucia.food", avatar: "L", avatarColor: "#fa709a",
    text: "Los colores, los olores, el ruido. Bangkok de noche es una fiesta para los sentidos.",
    qualitative: "Le encanto a muchos", pecUsers: ["M","P","A"], pecExtra: 7 },
];

const FEED_ITEMS = [
  { type:"pulse" as const, user:"marina.dev", avatar:"M", color:"#FF6B6B", text:"Hot take: GraphQL esta sobre-engineerado para el 80% de los casos", time:"2m", likes:41, pecs:3, sem:"green" },
  { type:"rss" as const, source:"MIT Technology Review", topic:"IA", title:"Los modelos de lenguaje aprenden a razonar sobre codigo", url:"technologyreview.com", time:"15m" },
  { type:"pulse" as const, user:"carlos.ui", avatar:"C", color:"#7C5CFC", text:"Nuevo articulo sobre design tokens. El futuro del diseno sistematizado es ahora.", time:"18m", likes:18, pecs:7, sem:"yellow" },
  { type:"rss" as const, source:"The Guardian", topic:"Clima", title:"Europa bate record de temperatura en marzo por tercer ano consecutivo", url:"theguardian.com", time:"22m" },
  { type:"pulse" as const, user:"ana.writes", avatar:"A", color:"#3DBBF0", text:"Leyendo 'El infinito en un junco'. Cada capitulo es una puerta a otro mundo.", time:"25m", likes:29, pecs:12, sem:"green" },
  { type:"rss" as const, source:"Ars Technica", topic:"Tech", title:"React Server Components cambian como pensamos sobre el rendering", url:"arstechnica.com", time:"30m" },
  { type:"pulse" as const, user:"pablo.foto", avatar:"P", color:"#2ECC87", text:"Madrid bajo la lluvia es otra ciudad. Salid a fotografiarla.", time:"35m", likes:53, pecs:8, sem:"red" },
  { type:"pulse" as const, user:"lucia.data", avatar:"L", color:"#FFB347", text:"Si tu dashboard tiene mas de 7 metricas, no es un dashboard. Es ruido.", time:"40m", likes:87, pecs:15, sem:"green" },
];

function SemaforoDot({ status, size = 10 }: { status: string; size?: number }) {
  const col = { green: C.semGreen, yellow: C.semYellow, red: C.semRed }[status] || C.semGreen;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:col, boxShadow:`0 0 ${size/2}px ${col}66`, border:`1.5px solid ${col}` }} />;
}

function PecBadge({ users, extra, onClick }: { users: string[]; extra: number; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(255,255,255,0.12)", border:"none", borderRadius:16, padding:"3px 8px 3px 4px", cursor:"pointer", backdropFilter:"blur(4px)" }}>
      <span style={{ fontSize:10, fontWeight:800, color:C.primary, letterSpacing:0.5 }}>PEC!</span>
      <div style={{ display:"flex" }}>
        {users.slice(0,3).map((a,i) => (
          <div key={i} style={{ width:18, height:18, borderRadius:"50%", background:"rgba(255,255,255,0.25)", border:"1.5px solid rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff", marginLeft:i>0?-5:0 }}>{a}</div>
        ))}
      </div>
      {extra > 0 && <span style={{ fontSize:9, color:"rgba(255,255,255,0.6)" }}>+{extra}</span>}
    </button>
  );
}

function TouchMode({ landscape }: { landscape: boolean }) {
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showText, setShowText] = useState(false);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [peced, setPeced] = useState<Record<number, boolean>>({});
  const [avatared, setAvatared] = useState<Record<number, boolean>>({});
  const [showPecDetail, setShowPecDetail] = useState(false);
  const startX = useRef(0);
  const total = TOUCH_POSTS.length;

  const onDown = (e: React.PointerEvent) => { if(!showText){ startX.current=e.clientX; setDragging(true); }};
  const onMove = (e: React.PointerEvent) => { if(dragging) setDragX(e.clientX - startX.current); };
  const onUp = () => {
    if(!dragging) return; setDragging(false);
    if(dragX<-50 && idx<total-1){ setIdx(idx+1); setShowText(false); setShowPecDetail(false); }
    else if(dragX>50 && idx>0){ setIdx(idx-1); setShowText(false); setShowPecDetail(false); }
    setDragX(0);
  };

  return (
    <div style={{ height:"100%", position:"relative", cursor:dragging?"grabbing":"grab", touchAction:"none" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      <div style={{ position:"absolute", top:6, left:0, right:0, display:"flex", justifyContent:"center", gap:4, zIndex:20 }}>
        {TOUCH_POSTS.map((_,i) => (
          <div key={i} style={{ width:i===idx?18:6, height:6, borderRadius:3, background:i===idx?"#fff":"rgba(255,255,255,0.4)", transition:"all 0.3s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
        ))}
      </div>
      {TOUCH_POSTS.map((post, i) => {
        const off = i - idx;
        if(off<-1 || off>2) return null;
        const x = off===0 ? dragX : 0;
        const sc = off===0 ? 1 : 1 - off*0.04;
        const ty = off===0 ? 0 : off*6;
        const op = off===0 ? 1 : off===1 ? 0.6 : 0.3;
        const rot = off===0 ? dragX*0.02 : 0;
        return (
          <div key={i} style={{
            position:"absolute", inset:0,
            transform:`translateX(${x}px) translateY(${ty}px) scale(${sc}) rotate(${rot}deg)`,
            opacity:op, transition:dragging&&off===0?"none":"all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            zIndex:10-off, pointerEvents:off===0?"auto":"none",
          }}>
            <div style={{ height:"100%", width:"100%", background:post.grad, display:"flex", flexDirection:"column", justifyContent:"flex-end", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, opacity:0.25 }}>
                  <Camera size={landscape?40:32} color="#fff" />
                  <span style={{ color:"#fff", fontSize:landscape?13:11, fontWeight:500 }}>{post.label}</span>
                </div>
              </div>
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:showText&&i===idx?"100%":"50%", background:showText&&i===idx?"rgba(0,0,0,0.5)":"linear-gradient(transparent, rgba(0,0,0,0.45))", transition:"all 0.4s", backdropFilter:showText&&i===idx?"blur(2px)":"none" }} />
              <div style={{ position:"relative", zIndex:5, padding:landscape?"0 14px 8px":"0 16px 12px" }}>
                {showText && i===idx && (
                  <div style={{ marginBottom:10, padding:landscape?"8px 12px":"12px 14px", background:"rgba(255,255,255,0.12)", borderRadius:14, backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.15)" }}>
                    <p style={{ color:"#fff", fontSize:landscape?12:13, lineHeight:1.6, margin:0, textShadow:"0 1px 3px rgba(0,0,0,0.3)" }}>{post.text}</p>
                  </div>
                )}
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontStyle:"italic" }}>{post.qualitative}</span>
                    <PecBadge users={post.pecUsers} extra={post.pecExtra} onClick={(e) => { e.stopPropagation(); setShowPecDetail(!showPecDetail); }} />
                  </div>
                  {showPecDetail && i===idx && (
                    <div style={{ marginTop:6, padding:"8px 10px", background:"rgba(255,255,255,0.12)", borderRadius:10, backdropFilter:"blur(8px)" }}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginBottom:4 }}>Le encanto a:</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {post.pecUsers.map((a,ai) => (
                          <div key={ai} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(255,255,255,0.1)", borderRadius:12, padding:"2px 8px 2px 3px" }}>
                            <div style={{ width:16, height:16, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff" }}>{a}</div>
                            <span style={{ fontSize:9, color:"#fff" }}>persona que sigues</span>
                          </div>
                        ))}
                        {post.pecExtra>0 && <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", alignSelf:"center" }}>+{post.pecExtra} que no sigues</span>}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:landscape?30:36, height:landscape?30:36, borderRadius:"50%", background:post.avatarColor+"44", border:"2px solid rgba(255,255,255,0.6)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:landscape?12:14, color:"#fff" }}>{post.avatar}</div>
                    <span style={{ fontSize:landscape?11:13, fontWeight:700, color:"#fff" }}>@{post.user}</span>
                  </div>
                  <div style={{ display:"flex", gap:landscape?6:8, alignItems:"center" }}>
                    <button onClick={(e)=>{e.stopPropagation();setAvatared(p=>({...p,[i]:!p[i]}))}} style={{
                      width:landscape?28:34, height:landscape?28:34, borderRadius:"50%",
                      border:avatared[i]?"2px solid #fff":"2px dashed rgba(255,255,255,0.4)",
                      background:avatared[i]?C.accent+"cc":"rgba(255,255,255,0.1)",
                      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:landscape?10:13, fontWeight:800, color:"#fff", transition:"all 0.2s", transform:avatared[i]?"scale(1.1)":"scale(1)",
                    }}>{avatared[i]?"YO":<User size={landscape?12:14} color="rgba(255,255,255,0.5)" />}</button>
                    <button onClick={(e)=>{e.stopPropagation();setLiked(p=>({...p,[i]:!p[i]}))}} style={{
                      background:liked[i]?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.08)",
                      border:"none", borderRadius:20, padding:landscape?"4px 8px":"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, transition:"all 0.2s",
                    }}><Heart size={landscape?14:16} color="#fff" fill={liked[i]?"#fff":"none"} /></button>
                    <button onClick={(e)=>{e.stopPropagation();setPeced(p=>({...p,[i]:!p[i]}))}} style={{
                      background:peced[i]?C.primary+"dd":"rgba(255,255,255,0.08)",
                      border:peced[i]?"1px solid rgba(255,255,255,0.4)":"none",
                      borderRadius:20, padding:landscape?"4px 8px":"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4,
                      transition:"all 0.25s", transform:peced[i]?"scale(1.08)":"scale(1)",
                    }}><span style={{ fontSize:landscape?10:12, fontWeight:900, color:"#fff", letterSpacing:1 }}>{peced[i]?"PEC!":"PEC"}</span></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {!dragging && <div onClick={()=>{setShowText(!showText);setShowPecDetail(false)}} style={{ position:"absolute", inset:0, zIndex:15, cursor:"pointer" }} />}
      {dragging && Math.abs(dragX)>40 && (
        <div style={{ position:"absolute", top:"50%", left:dragX>0?16:"auto", right:dragX<0?16:"auto", transform:"translateY(-50%)", zIndex:30, width:44, height:44, borderRadius:"50%", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {dragX>0 ? <ChevronLeft size={22} color="#fff" /> : <ChevronRight size={22} color="#fff" />}
        </div>
      )}
      {!showText && !dragging && (
        <div style={{ position:"absolute", bottom:landscape?50:70, left:0, right:0, textAlign:"center", zIndex:20, pointerEvents:"none" }}>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)", background:"rgba(0,0,0,0.2)", padding:"3px 10px", borderRadius:10, backdropFilter:"blur(4px)" }}>
            Toca para ver texto · Desliza como un libro
          </span>
        </div>
      )}
    </div>
  );
}

function FeedMode({ landscape }: { landscape: boolean }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [peced, setPeced] = useState<Record<string, boolean>>({});
  const [avatared, setAvatared] = useState<Record<string, boolean>>({});
  const [topicFilter, setTopicFilter] = useState("Todo");
  const topics = ["Todo", "IA", "Tech", "Clima", "Diseno", "Ciencia"];
  const filtered = topicFilter === "Todo" ? FEED_ITEMS : FEED_ITEMS.filter(item =>
    item.type === "pulse" || ("topic" in item && item.topic === topicFilter)
  );

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"6px 12px", display:"flex", gap:6, overflowX:"auto", flexShrink:0, borderBottom:`1px solid ${C.border}` }}>
        {topics.map((t,i) => (
          <div key={i} onClick={()=>setTopicFilter(t)} style={{
            padding:"4px 12px", borderRadius:14, fontSize:10, fontWeight:topicFilter===t?700:500, whiteSpace:"nowrap", cursor:"pointer",
            background:topicFilter===t?C.secondary:C.surfaceAlt, color:topicFilter===t?"#fff":C.textMuted,
            border:`1px solid ${topicFilter===t?C.secondary:C.border}`, transition:"all 0.2s",
          }}>{t}</div>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {filtered.map((item, i) => (
          <div key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
            {item.type === "rss" ? (
              <div style={{ padding:landscape?"8px 12px":"10px 16px", background:C.secondary+"06" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <Rss size={10} color={C.secondary} />
                  <span style={{ fontSize:9, fontWeight:600, color:C.secondary }}>{"source" in item && item.source}</span>
                  <div style={{ padding:"1px 6px", background:C.secondary+"14", borderRadius:6, fontSize:8, fontWeight:600, color:C.secondary }}>{"topic" in item && item.topic}</div>
                  <span style={{ fontSize:9, color:C.textDim, marginLeft:"auto" }}>{item.time}</span>
                </div>
                <div style={{ fontSize:landscape?11:12, fontWeight:600, color:C.text, lineHeight:1.4, marginBottom:4 }}>{"title" in item && item.title}</div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <ExternalLink size={10} color={C.textDim} />
                  <span style={{ fontSize:9, color:C.textDim }}>{"url" in item && item.url}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding:landscape?"10px 12px":"12px 16px" }}>
                <div style={{ display:"flex", gap:10 }}>
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <div style={{ width:landscape?30:36, height:landscape?30:36, borderRadius:"50%", background:("color" in item ? item.color : "#ccc")+"20", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:landscape?11:13, color:"color" in item ? item.color : "#ccc", border:`2px solid ${"color" in item ? item.color : "#ccc"}44` }}>{"avatar" in item && item.avatar}</div>
                    {"sem" in item && <div style={{ position:"absolute", bottom:-1, right:-1 }}><SemaforoDot status={item.sem} size={8} /></div>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:landscape?11:12, fontWeight:700, color:C.text }}>@{"user" in item && item.user}</span>
                      <span style={{ fontSize:10, color:C.textDim }}>{item.time}</span>
                    </div>
                    <div style={{ fontSize:landscape?12:13, color:C.text, lineHeight:1.55, marginBottom:8 }}>{"text" in item && item.text}</div>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <button onClick={()=>setLiked(p=>({...p,[`f${i}`]:!p[`f${i}`]}))} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                        <Heart size={14} color={liked[`f${i}`]?C.primary:C.textDim} fill={liked[`f${i}`]?C.primary:"none"} />
                        <span style={{ fontSize:11, color:liked[`f${i}`]?C.primary:C.textDim }}>{"likes" in item ? item.likes+(liked[`f${i}`]?1:0) : 0}</span>
                      </button>
                      <button onClick={()=>setPeced(p=>({...p,[`f${i}`]:!p[`f${i}`]}))} style={{ display:"flex", alignItems:"center", gap:3, background:peced[`f${i}`]?C.primary+"14":"none", border:"none", borderRadius:12, padding:peced[`f${i}`]?"2px 8px":0, cursor:"pointer" }}>
                        <span style={{ fontSize:11, fontWeight:800, color:peced[`f${i}`]?C.primary:C.textDim }}>PEC{peced[`f${i}`]?"!":""}</span>
                        <span style={{ fontSize:11, color:peced[`f${i}`]?C.primary:C.textDim }}>{"pecs" in item ? item.pecs+(peced[`f${i}`]?1:0) : 0}</span>
                      </button>
                      <button onClick={()=>setAvatared(p=>({...p,[`f${i}`]:!p[`f${i}`]}))} style={{
                        width:22, height:22, borderRadius:"50%",
                        border:avatared[`f${i}`]?`2px solid ${C.accent}`:`1.5px dashed ${C.textDim}`,
                        background:avatared[`f${i}`]?C.accent+"20":"transparent",
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      }}>{avatared[`f${i}`] ? <span style={{ fontSize:8, fontWeight:800, color:C.accent }}>YO</span> : <User size={9} color={C.textDim} />}</button>
                      <div style={{ marginLeft:"auto" }}><MessageCircle size={14} color={C.textDim} /></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding:landscape?"6px 12px":"10px 16px", background:C.surface, display:"flex", alignItems:"center", gap:8, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ flex:1, padding:landscape?"6px 12px":"8px 14px", background:C.surfaceAlt, borderRadius:20, fontSize:12, color:C.textDim, border:`1px solid ${C.border}` }}>Comparte algo con el mundo...</div>
        <div style={{ width:landscape?28:34, height:landscape?28:34, borderRadius:"50%", background:C.secondary, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Send size={landscape?13:15} color="#fff" />
        </div>
      </div>
    </div>
  );
}

function PolisMode({ landscape }: { landscape: boolean }) {
  const [foto, setFoto] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const [publicado, setPublicado] = useState(false);
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File) => {
    const url = URL.createObjectURL(f);
    setFoto(url);
    setNombre(f.name.replace(/\.[^.]+$/, ""));
    setPublicado(false);
  };

  const reiniciar = () => {
    if (foto) URL.revokeObjectURL(foto);
    setFoto(null);
    setNombre("");
    setPublicado(false);
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onFile(f); }} />
      <input ref={inputGaleriaRef} type="file" accept="image/*" style={{ display:"none" }} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onFile(f); }} />

      {/* Barra superior de contexto */}
      <div style={{ padding:landscape?"6px 12px":"8px 16px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.border}`, flexShrink:0, background:C.surface }}>
        <MapPin size={landscape?11:13} color={C.accent} />
        <span style={{ fontSize:landscape?10:11, fontWeight:600, color:C.text }}>Vegueta, Las Palmas</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
          <SemaforoDot status="green" size={7} />
          <span style={{ fontSize:9, color:C.textMuted }}>28°C</span>
        </div>
      </div>

      {/* Estado vacío */}
      {!foto && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:landscape?"10px 20px":"20px", gap:landscape?10:16 }}>
          <div style={{ width:landscape?60:80, height:landscape?60:80, borderRadius:"50%", background:`linear-gradient(135deg, ${C.accent}22, ${C.primary}22)`, display:"flex", alignItems:"center", justifyContent:"center", border:`2px dashed ${C.accent}66` }}>
            <Camera size={landscape?26:36} color={C.accent} />
          </div>
          <div style={{ textAlign:"center", maxWidth:240 }}>
            <p style={{ margin:"0 0 4px", fontSize:landscape?12:14, fontWeight:700, color:C.text }}>Mapea tu entorno</p>
            <p style={{ margin:0, fontSize:landscape?9:11, color:C.textMuted, lineHeight:1.5 }}>Captura o sube una foto de lo que ves. POLIS la situará sobre el mapa de la ciudad.</p>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:landscape?4:8 }}>
            <button onClick={()=>inputCamaraRef.current?.click()} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:landscape?"6px 14px":"10px 18px", borderRadius:22,
              background:C.primary, color:"#fff", border:"none", cursor:"pointer",
              fontSize:landscape?11:12, fontWeight:700, boxShadow:C.shadow,
            }}>
              <Camera size={landscape?12:14} color="#fff" />
              Cámara
            </button>
            <button onClick={()=>inputGaleriaRef.current?.click()} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:landscape?"6px 14px":"10px 18px", borderRadius:22,
              background:C.surface, color:C.text, border:`1px solid ${C.border}`, cursor:"pointer",
              fontSize:landscape?11:12, fontWeight:700,
            }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image size={landscape?12:14} color={C.textMuted} />
              Galería
            </button>
          </div>
          <p style={{ marginTop:landscape?4:12, fontSize:9, color:C.textDim, textAlign:"center", maxWidth:240, lineHeight:1.4 }}>
            La ubicación se añade automáticamente. Puedes revisarla antes de publicar.
          </p>
        </div>
      )}

      {/* Preview + publicar */}
      {foto && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", background:"#000" }}>
          {/* Imagen */}
          <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="captura" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} />

            {/* Botón cerrar */}
            <button onClick={reiniciar} style={{
              position:"absolute", top:8, right:8, width:28, height:28, borderRadius:"50%",
              background:"rgba(0,0,0,0.5)", border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)",
            }}>
              <X size={14} color="#fff" />
            </button>

            {/* Chip de ubicación sobre la imagen */}
            <div style={{
              position:"absolute", top:8, left:8,
              display:"flex", alignItems:"center", gap:4,
              padding:"4px 8px", borderRadius:12,
              background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)",
            }}>
              <MapPin size={10} color="#fff" />
              <span style={{ fontSize:9, fontWeight:600, color:"#fff" }}>28.099, −15.413</span>
            </div>

            {/* Banner publicado */}
            {publicado && (
              <div style={{
                position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                padding:"14px 22px", borderRadius:18, background:"rgba(255,255,255,0.95)",
                display:"flex", flexDirection:"column", alignItems:"center", gap:4, boxShadow:C.shadowLift,
              }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:C.success, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Upload size={18} color="#fff" />
                </div>
                <span style={{ fontSize:12, fontWeight:800, color:C.text }}>Publicado en POLIS</span>
                <span style={{ fontSize:10, color:C.textMuted }}>+10 XP social</span>
              </div>
            )}
          </div>

          {/* Metadatos + acciones */}
          <div style={{ padding:landscape?"6px 12px 8px":"10px 14px 12px", background:C.surface, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <Camera size={11} color={C.textDim} />
              <span style={{ fontSize:10, color:C.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{nombre || "captura"}</span>
              <span style={{ fontSize:9, color:C.textDim }}>hace instantes</span>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={reiniciar} style={{
                flex:1, padding:"8px 0", borderRadius:10,
                background:C.surface, color:C.text, border:`1px solid ${C.border}`,
                fontSize:11, fontWeight:600, cursor:"pointer",
              }}>
                Descartar
              </button>
              <button onClick={()=>setPublicado(true)} disabled={publicado} style={{
                flex:2, padding:"8px 0", borderRadius:10,
                background:publicado?C.success:`linear-gradient(135deg, ${C.primary}, ${C.accent})`,
                color:"#fff", border:"none", fontSize:11, fontWeight:700,
                cursor:publicado?"default":"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              }}>
                <Upload size={12} color="#fff" />
                {publicado ? "Publicado" : "Publicar en POLIS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneMockup({ mode: initialMode }: { mode: string }) {
  const [mode, setMode] = useState(initialMode || "touch");
  const [landscape, setLandscape] = useState(false);
  const phoneW = landscape ? 580 : 320;
  const phoneH = landscape ? 320 : 600;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
      <button onClick={()=>setLandscape(!landscape)} style={{
        padding:"8px 18px", borderRadius:10, border:`1px solid ${C.border}`,
        background:landscape?C.primary+"14":C.surface, color:landscape?C.primary:C.textMuted,
        fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6,
        boxShadow:C.shadow, transition:"all 0.3s",
      }}>
        <span style={{ fontSize:16, transition:"transform 0.3s", transform:landscape?"rotate(90deg)":"rotate(0)" }}>📱</span>
        {landscape ? "Paisaje — foto inmersiva" : "Girar a paisaje"}
      </button>
      <div style={{ width:phoneW+16, background:"#1a1a1a", borderRadius:landscape?24:36, padding:8, boxShadow:C.shadowLift, transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ background:C.bg, borderRadius:landscape?18:30, overflow:"hidden", height:phoneH, display:"flex", flexDirection:"column", transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:landscape?"4px 16px 2px":"10px 20px 4px", fontSize:12, fontWeight:600, color:C.text, flexShrink:0 }}>
            <span style={{ fontSize:landscape?10:12 }}>9:41</span>
            {!landscape && <div style={{ width:90, height:24, background:"#1a1a1a", borderRadius:14 }} />}
            <span style={{ fontSize:landscape?9:11 }}>100%</span>
          </div>
          <div style={{ padding:landscape?"2px 12px 4px":"6px 16px 8px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:landscape?14:18, fontWeight:800, letterSpacing:1 }}>
              <span style={{ color:C.primary }}>K</span>
              <span style={{ color:C.text }}>OINOS</span>
            </span>
            <div style={{ display:"flex", background:C.surfaceAlt, borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}` }}>
              <button onClick={()=>setMode("touch")} style={{
                padding:landscape?"4px 8px":"6px 10px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer",
                background:mode==="touch"?C.primary:"transparent", color:mode==="touch"?"#fff":C.textMuted,
                borderRadius:mode==="touch"?8:0, transition:"all 0.2s", display:"flex", alignItems:"center", gap:3,
              }}><Lock size={9} /> TOUCH</button>
              <button onClick={()=>setMode("feed")} style={{
                padding:landscape?"4px 8px":"6px 10px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer",
                background:mode==="feed"?C.secondary:"transparent", color:mode==="feed"?"#fff":C.textMuted,
                borderRadius:mode==="feed"?8:0, transition:"all 0.2s", display:"flex", alignItems:"center", gap:3,
              }}><Globe size={9} /> FEED</button>
              <button onClick={()=>setMode("polis")} style={{
                padding:landscape?"4px 8px":"6px 10px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer",
                background:mode==="polis"?C.accent:"transparent", color:mode==="polis"?"#fff":C.textMuted,
                borderRadius:mode==="polis"?8:0, transition:"all 0.2s", display:"flex", alignItems:"center", gap:3,
              }}><MapPin size={9} /> POLIS</button>
            </div>
            <Bell size={landscape?16:18} color={C.textMuted} />
          </div>
          <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
            {mode === "touch" ? <TouchMode landscape={landscape} />
              : mode === "feed" ? <FeedMode landscape={landscape} />
              : <PolisMode landscape={landscape} />}
          </div>
          <div style={{ display:"flex", justifyContent:"space-around", padding:landscape?"6px 0 8px":"8px 0 14px", borderTop:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
            {[
              { icon:Image, label:"Touch", active:mode==="touch", click:()=>setMode("touch"), color:C.primary },
              { icon:Search, label:"Buscar", active:false, click:undefined, color:C.textDim },
              { icon:Camera, label:"POLIS", accent:true, active:mode==="polis", click:()=>setMode("polis"), color:C.accent },
              { icon:Globe, label:"Feed", active:mode==="feed", click:()=>setMode("feed"), color:C.secondary },
              { icon:User, label:"Perfil", active:false, click:undefined, color:C.textDim },
            ].map((t,i) => (
              <div key={i} onClick={t.click} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:t.click?"pointer":"default" }}>
                {t.accent ? (
                  <div style={{
                    width:landscape?28:36, height:landscape?28:36, borderRadius:"50%",
                    background: t.active
                      ? `linear-gradient(135deg, ${C.accent}, ${C.primary})`
                      : `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    marginTop:landscape?-8:-14, border:`3px solid ${C.bg}`,
                    boxShadow: t.active ? `0 0 0 3px ${C.accent}33, ${C.shadow}` : C.shadow,
                    transition:"all 0.25s",
                  }}>
                    <t.icon size={landscape?14:18} color="#fff" />
                  </div>
                ) : (
                  <t.icon size={landscape?16:20} color={t.active?t.color:C.textDim} />
                )}
                <span style={{ fontSize:landscape?8:9, color:t.active?t.color:C.textDim, fontWeight:t.active?700:400 }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ textAlign:"center", fontSize:11, color:C.textDim, maxWidth:340, lineHeight:1.6 }}>
        {mode === "touch" && <><strong style={{color:C.text}}>TOUCH</strong> — Fotos a pantalla completa. Toca para texto. Desliza como un libro. Solo tus conexiones.</>}
        {mode === "feed" && <><strong style={{color:C.text}}>FEED</strong> — Tu voz publica + articulos por temas. Semaforo de disponibilidad.</>}
        {mode === "polis" && <><strong style={{color:C.text}}>POLIS</strong> — Captura tu entorno. Foto + ubicación, situada sobre el mapa de la ciudad.</>}
      </div>
    </div>
  );
}

export default function ShowcasePage() {
  const [view, setView] = useState("both");

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding:"24px 32px" }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:36, fontWeight:800, letterSpacing:2, marginBottom:4 }}>
          <span style={{ color:C.primary }}>K</span>
          <span style={{ color:C.text }}>OINOS</span>
        </div>
        <p style={{ color:C.textMuted, fontSize:13, margin:0 }}>Red social dual — dos experiencias, una identidad</p>
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:16, flexWrap:"wrap" }}>
          {[
            { id:"both", label:"Los tres", color:C.text },
            { id:"touch", label:"TOUCH", color:C.primary },
            { id:"feed", label:"FEED", color:C.secondary },
            { id:"polis", label:"POLIS", color:C.accent },
          ].map(v => (
            <button key={v.id} onClick={()=>setView(v.id)} style={{
              padding:"8px 20px", borderRadius:10, border:`1px solid ${view===v.id?v.color:C.border}`,
              background:view===v.id?v.color+"14":C.surface, color:view===v.id?v.color:C.textMuted,
              fontSize:12, fontWeight:view===v.id?700:500, cursor:"pointer", transition:"all 0.2s",
            }}>{v.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"center", gap:40, flexWrap:"wrap", alignItems:"start" }}>
        {(view === "both" || view === "touch") && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px", background:C.primary+"14", borderRadius:10, border:`1px solid ${C.primary}22` }}>
              <Lock size={14} color={C.primary} />
              <span style={{ fontSize:14, fontWeight:700, color:C.primary }}>TOUCH</span>
              <span style={{ fontSize:11, color:C.textMuted }}>— Intimo y visual</span>
            </div>
            <PhoneMockup mode="touch" />
          </div>
        )}
        {(view === "both" || view === "feed") && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px", background:C.secondary+"14", borderRadius:10, border:`1px solid ${C.secondary}22` }}>
              <Globe size={14} color={C.secondary} />
              <span style={{ fontSize:14, fontWeight:700, color:C.secondary }}>FEED</span>
              <span style={{ fontSize:11, color:C.textMuted }}>— Publico y social</span>
            </div>
            <PhoneMockup mode="feed" />
          </div>
        )}
        {(view === "both" || view === "polis") && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px", background:C.accent+"14", borderRadius:10, border:`1px solid ${C.accent}22` }}>
              <MapPin size={14} color={C.accent} />
              <span style={{ fontSize:14, fontWeight:700, color:C.accent }}>POLIS</span>
              <span style={{ fontSize:11, color:C.textMuted }}>— Situado y ciudadano</span>
            </div>
            <PhoneMockup mode="polis" />
          </div>
        )}
      </div>
      <div style={{ display:"flex", justifyContent:"center", gap:32, marginTop:32, padding:"16px 0", borderTop:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:10, color:C.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Reacciones</div>
          <div style={{ display:"flex", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <Heart size={12} color={C.primary} />
              <span style={{ fontSize:11, color:C.textMuted }}>Me gusta</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:11, fontWeight:800, color:C.primary }}>PEC!</span>
              <span style={{ fontSize:11, color:C.textMuted }}>Me encanta</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:16, height:16, borderRadius:"50%", border:`1.5px solid ${C.accent}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:7, fontWeight:800, color:C.accent }}>YO</span>
              </div>
              <span style={{ fontSize:11, color:C.textMuted }}>Interes directo</span>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:C.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Semaforo</div>
          <div style={{ display:"flex", gap:12 }}>
            {[{s:"green",l:"Abierto"},{s:"yellow",l:"Selectivo"},{s:"red",l:"Cerrado"}].map((x,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <SemaforoDot status={x.s} size={8} />
                <span style={{ fontSize:11, color:C.textMuted }}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
