"use client";

// ─── POLIS · Juego: Motor 3D (Three.js + R3F) ─────────────────────
// Vista 3D del barrio con avatar caminable, cámara TPS detrás-arriba,
// colisiones contra edificios del catastro INSPIRE, calles + parques
// + POIs proyectados desde OSM. Mobile-first con joystick virtual.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { KeyboardControls, Sky, Stats, useKeyboardControls } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import {
  useEscena3D,
  alturaVisual,
  distEdifMin,
  type EdifMesh,
  type Escena3D,
} from "@/lib/polis-juego/useEscena3D";

const RADIO_ANOTABLE = 25;
const RADIO_AVATAR = 0.6;
const RADIO_POI = 12;

// ───────────────────────────────────────────────────────────────
// Componente raíz
// ───────────────────────────────────────────────────────────────

export type AnotacionVisual = { capital: string };

export type Motor3DProps = {
  /** anotaciones aplicadas hasta ahora (para colorear edificios). */
  anotaciones: Map<string, AnotacionVisual>;
  /** callback al pulsar un edificio dentro del aro. */
  onSeleccionarEdificio: (e: EdifMesh) => void;
  /** callback al estar cerca de un POI con nombre. */
  onPoiCerca: (poi: { n: string; k: string | null } | null) => void;
  /** callback con datos en vivo (calle actual, anotables cerca). */
  onTick?: (info: {
    avatarPos: [number, number];
    anotablesCerca: number;
    calleActual: string | null;
  }) => void;
};

export function Motor3D(props: Motor3DProps) {
  const { escena, error } = useEscena3D();

  if (error) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-sangre)",
          color: "var(--color-piedra)",
        }}
      >
        <p className="display italic">No se pudo cargar la escena.</p>
        <p className="text-[0.78rem] mt-2">{error}</p>
        <p className="text-[0.78rem] mt-2">
          Asegúrate de servir <code>/public/polis-juego/vegueta-triana-full.json</code>{" "}
          desde el dev server (<code>npm run dev</code>).
        </p>
      </div>
    );
  }

  if (!escena) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <p className="display italic">Cargando catastro…</p>
        <p className="text-[0.78rem] mt-2">
          1.321 edificios INSPIRE + 472 calles OSM + 187 POIs
        </p>
      </div>
    );
  }

  return <Motor3DCargado escena={escena} {...props} />;
}

// ───────────────────────────────────────────────────────────────
// Motor con escena ya cargada
// ───────────────────────────────────────────────────────────────

const KEYMAP = [
  { name: "adelante", keys: ["w", "W", "ArrowUp"] },
  { name: "atras", keys: ["s", "S", "ArrowDown"] },
  { name: "izquierda", keys: ["a", "A", "ArrowLeft"] },
  { name: "derecha", keys: ["d", "D", "ArrowRight"] },
  { name: "correr", keys: ["Shift"] },
];

function Motor3DCargado({
  escena,
  anotaciones,
  onSeleccionarEdificio,
  onPoiCerca,
  onTick,
}: Motor3DProps & { escena: Escena3D }) {
  // joystick virtual (referencia compartida con el canvas)
  const joystick = useRef({ x: 0, z: 0 });

  return (
    <div className="relative w-full" style={{ height: "min(82vh, 720px)" }}>
      <KeyboardControls map={KEYMAP}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [escena.spawn[0] - 18, 22, escena.spawn[1] + 18], fov: 50, near: 0.5, far: 600 }}
          gl={{ antialias: true }}
          style={{
            borderRadius: 12,
            background: "linear-gradient(180deg,#cfe1f2 0%,#dde6c8 60%,#c7d6a4 100%)",
          }}
        >
          <Suspense fallback={null}>
            <Sky distance={450000} sunPosition={[40, 60, 30]} inclination={0.49} azimuth={0.25} />
            <ambientLight intensity={0.55} />
            <directionalLight
              position={[80, 100, 60]}
              intensity={1.0}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-left={-200}
              shadow-camera-right={200}
              shadow-camera-top={200}
              shadow-camera-bottom={-200}
            />
            <Suelo />
            <Parques parks={escena.parks} />
            <Calles roads={escena.roads} />
            <Edificios edificios={escena.edificios} anotaciones={anotaciones} />
            <Pois pois={escena.pois} />
            <PlayerYCamara
              escena={escena}
              joystick={joystick}
              onSeleccionarEdificio={onSeleccionarEdificio}
              onPoiCerca={onPoiCerca}
              onTick={onTick}
            />
          </Suspense>
        </Canvas>
      </KeyboardControls>
      <JoystickVirtual joystick={joystick} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Suelo
// ───────────────────────────────────────────────────────────────

function Suelo() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[1200, 1200]} />
      <meshStandardMaterial color="#e9e1cd" roughness={0.95} />
    </mesh>
  );
}

// ───────────────────────────────────────────────────────────────
// Parques (planos verdes)
// ───────────────────────────────────────────────────────────────

function Parques({ parks }: { parks: Escena3D["parks"] }) {
  return (
    <group>
      {parks.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          position={[0, 0.02, 0]}
          receiveShadow
        >
          <meshStandardMaterial color={parkColor(p.k)} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function parkColor(k: string | null): string {
  switch (k) {
    case "park":
      return "#bcd2a3";
    case "garden":
      return "#c5d8ad";
    case "grass":
      return "#bccfa1";
    case "forest":
      return "#9bb88a";
    case "playground":
      return "#d5dfa9";
    default:
      return "#c0d39c";
  }
}

// ───────────────────────────────────────────────────────────────
// Calles (líneas anchas como tubos planos)
// ───────────────────────────────────────────────────────────────

const CALLE_W: Record<string, number> = {
  primary: 9,
  trunk: 9,
  secondary: 8,
  tertiary: 7,
  residential: 6,
  unclassified: 6,
  living_street: 6,
  service: 5,
  pedestrian: 6,
  footway: 4,
  path: 4,
  cycleway: 4,
  motorway: 10,
};

function Calles({ roads }: { roads: Escena3D["roads"] }) {
  // Para cada road, generamos un BufferGeometry de "ribbon" plano: dos
  // triangle strips a lo largo de la línea con anchura proporcional al
  // tipo de calle. Más eficiente que muchas <Line>.
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    let vIdx = 0;
    for (const r of roads) {
      const w = (CALLE_W[r.k || "residential"] || 5) / 2;
      const pts = r.points;
      if (pts.length < 2) continue;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        const dirX = next.x - prev.x;
        const dirZ = next.z - prev.z;
        const len = Math.hypot(dirX, dirZ) || 1;
        const nx = -dirZ / len;
        const nz = dirX / len;
        positions.push(a.x + nx * w, 0.05, a.z + nz * w);
        positions.push(a.x - nx * w, 0.05, a.z - nz * w);
        if (i > 0) {
          indices.push(vIdx - 2, vIdx - 1, vIdx);
          indices.push(vIdx - 1, vIdx + 1, vIdx);
        }
        vIdx += 2;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [roads]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#d4c79b" roughness={0.85} />
    </mesh>
  );
}

// ───────────────────────────────────────────────────────────────
// Edificios extruidos (cada uno una mesh, transparencia condicional)
// ───────────────────────────────────────────────────────────────

const COLOR_CAPITAL: Record<string, string> = {
  comun: "#5B7A3E",
  residente: "#B4832E",
  autonomo: "#C98A1A",
  rentista: "#A14B2A",
  corporativo: "#6E2A1E",
};

function Edificios({
  edificios,
  anotaciones,
}: {
  edificios: EdifMesh[];
  anotaciones: Map<string, AnotacionVisual>;
}) {
  // Un solo useFrame global itera todos los materiales para ajustar
  // alpha/transparencia. Mucho más barato que un useFrame por mesh.
  const matsRef = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  matsRef.current.length = edificios.length;

  useFrame((state) => {
    const target = state.scene.userData.avatarPos as THREE.Vector3 | undefined;
    if (!target) return;
    const cam = state.camera.position;
    const camDist = Math.hypot(cam.x - target.x, cam.z - target.z);
    for (let i = 0; i < edificios.length; i++) {
      const m = matsRef.current[i];
      if (!m) continue;
      const e = edificios[i];
      const dx = e.cxz[0] - target.x;
      const dz = e.cxz[1] - target.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 18) {
        if (m.transparent) { m.transparent = false; m.opacity = 1; m.needsUpdate = true; }
        continue;
      }
      const edifCam = Math.hypot(cam.x - e.cxz[0], cam.z - e.cxz[1]);
      const entreMedias = edifCam < camDist;
      if (entreMedias && dist < 12) {
        if (!m.transparent || m.opacity !== 0.35) {
          m.transparent = true; m.opacity = 0.35; m.needsUpdate = true;
        }
      } else if (entreMedias && dist < 18) {
        if (!m.transparent || m.opacity !== 0.6) {
          m.transparent = true; m.opacity = 0.6; m.needsUpdate = true;
        }
      } else {
        if (m.transparent) { m.transparent = false; m.opacity = 1; m.needsUpdate = true; }
      }
    }
  });

  return (
    <group>
      {edificios.map((e, i) => {
        const colorBase = anotaciones.get(e.id)
          ? COLOR_CAPITAL[anotaciones.get(e.id)!.capital] || "#a89f8a"
          : "#cfc4ad";
        return (
          <mesh
            key={e.id}
            geometry={e.geometry}
            castShadow
            receiveShadow
            userData={{ tipo: "edificio", id: e.id }}
          >
            <meshStandardMaterial
              ref={(r) => { matsRef.current[i] = r; }}
              color={colorBase}
              roughness={0.78}
              metalness={0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ───────────────────────────────────────────────────────────────
// POIs como cilindros bajos con marcador
// ───────────────────────────────────────────────────────────────

function Pois({ pois }: { pois: Escena3D["pois"] }) {
  return (
    <group>
      {pois.map((p, i) => (
        <group key={i} position={[p.xz[0], 0, p.xz[1]]}>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 2, 12]} />
            <meshStandardMaterial color="#FAF7F0" emissive="#FFE3A8" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 2.4, 0]}>
            <sphereGeometry args={[0.45, 12, 12]} />
            <meshStandardMaterial color="#B4832E" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ───────────────────────────────────────────────────────────────
// Player + cámara TPS + colisión
// ───────────────────────────────────────────────────────────────

function PlayerYCamara({
  escena,
  joystick,
  onSeleccionarEdificio,
  onPoiCerca,
  onTick,
}: {
  escena: Escena3D;
  joystick: React.MutableRefObject<{ x: number; z: number }>;
  onSeleccionarEdificio: (e: EdifMesh) => void;
  onPoiCerca: (p: { n: string; k: string | null } | null) => void;
  onTick?: Motor3DProps["onTick"];
}) {
  const [, get] = useKeyboardControls();
  const playerPos = useRef(new THREE.Vector3(escena.spawn[0], 0, escena.spawn[1]));
  const playerRef = useRef<THREE.Group>(null);
  const aroRef = useRef<THREE.Mesh>(null);
  const camOff = useRef(new THREE.Vector3(-12, 14, 12));
  const tickAcc = useRef(0);
  const poiCercaRef = useRef<string | null>(null);
  const { scene } = useThree();

  // Compartir avatarPos con los edificios para transparencia.
  scene.userData.avatarPos = playerPos.current;

  useFrame((state, dt) => {
    const t = Math.min(0.05, dt);
    const k = get();

    let vx = 0, vz = 0;
    if (k.adelante) vz -= 1;
    if (k.atras) vz += 1;
    if (k.izquierda) vx -= 1;
    if (k.derecha) vx += 1;
    if (joystick.current.x || joystick.current.z) {
      vx = joystick.current.x;
      vz = joystick.current.z;
    }
    const m = Math.hypot(vx, vz);
    if (m > 1) { vx /= m; vz /= m; }

    const VEL = k.correr ? 18 : 11;
    const nx = playerPos.current.x + vx * VEL * t;
    const nz = playerPos.current.z + vz * VEL * t;

    // Colisión: si nuevo punto cae dentro de un edificio cercano, slide
    // probando solo X o solo Z. Edificios filtrados por dist < 25 m.
    const cercanos = escena.edificios.filter((e) => {
      const dx = e.cxz[0] - playerPos.current.x;
      const dz = e.cxz[1] - playerPos.current.z;
      return Math.hypot(dx, dz) < 30;
    });
    const colision = (x: number, z: number) =>
      cercanos.some((e) => distEdifMin(x, z, e.xz) < RADIO_AVATAR);

    if (!colision(nx, nz)) {
      playerPos.current.x = nx;
      playerPos.current.z = nz;
    } else if (!colision(nx, playerPos.current.z)) {
      playerPos.current.x = nx;
    } else if (!colision(playerPos.current.x, nz)) {
      playerPos.current.z = nz;
    }

    // Mover mesh del player
    if (playerRef.current) {
      playerRef.current.position.copy(playerPos.current);
      // Mirar en la dirección del movimiento si lo hay
      if (vx || vz) {
        const ang = Math.atan2(vx, vz);
        playerRef.current.rotation.y = ang;
      }
    }

    // Cámara TPS: lerp hacia (player + offset). Offset rota lentamente
    // para sensación de cámara orbital ligera siguiendo movimiento.
    const target = playerPos.current;
    const desired = new THREE.Vector3(
      target.x + camOff.current.x,
      camOff.current.y,
      target.z + camOff.current.z,
    );
    state.camera.position.lerp(desired, 1 - Math.exp(-6 * t));
    state.camera.lookAt(target.x, 1.0, target.z);

    // Aro anotable
    if (aroRef.current) {
      aroRef.current.position.set(target.x, 0.06, target.z);
      const tt = state.clock.elapsedTime;
      const mat = aroRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(tt * 2) * 0.12;
    }

    // Tick (~10 Hz para no saturar React).
    tickAcc.current += t;
    if (tickAcc.current > 0.1) {
      tickAcc.current = 0;
      let n = 0;
      for (const e of cercanos) {
        if (distEdifMin(target.x, target.z, e.xz) <= RADIO_ANOTABLE) n++;
      }
      const calle = calleMasCercana(target.x, target.z, escena.roads);
      onTick?.({
        avatarPos: [target.x, target.z],
        anotablesCerca: n,
        calleActual: calle,
      });

      // POI cerca
      let mn = RADIO_POI;
      let poiActual: { n: string; k: string | null } | null = null;
      for (const p of escena.pois) {
        if (!p.n) continue;
        const d = Math.hypot(p.xz[0] - target.x, p.xz[1] - target.z);
        if (d < mn) { mn = d; poiActual = { n: p.n, k: p.k }; }
      }
      const poiNombre = poiActual?.n || null;
      if (poiNombre !== poiCercaRef.current) {
        poiCercaRef.current = poiNombre;
        onPoiCerca(poiActual);
      }
    }
  });

  // Click en edificio dentro del aro → callback
  return (
    <>
      <group ref={playerRef}>
        {/* Cuerpo */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <capsuleGeometry args={[0.45, 1.0, 6, 12]} />
          <meshStandardMaterial color="#B4832E" />
        </mesh>
        {/* Cabeza */}
        <mesh position={[0, 1.85, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color="#FAF7F0" />
        </mesh>
        {/* Marca direccional */}
        <mesh position={[0, 1, -0.4]}>
          <boxGeometry args={[0.4, 0.1, 0.1]} />
          <meshStandardMaterial color="#1A1714" />
        </mesh>
      </group>

      {/* Aro anotable */}
      <mesh ref={aroRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RADIO_ANOTABLE - 0.4, RADIO_ANOTABLE, 64]} />
        <meshBasicMaterial color="#B4832E" transparent opacity={0.3} />
      </mesh>

      {/* Pickeable: detector de clicks */}
      <ClickEdificios
        escena={escena}
        avatarRef={playerPos}
        onSeleccionarEdificio={onSeleccionarEdificio}
      />
    </>
  );
}

function calleMasCercana(
  x: number,
  z: number,
  roads: Escena3D["roads"],
): string | null {
  let mn = 1e9;
  let nombre: string | null = null;
  for (const r of roads) {
    if (!r.n) continue;
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i];
      const b = r.points[i + 1];
      const A = x - a.x, B = z - a.z, C = b.x - a.x, D = b.z - a.z;
      const dot = A * C + B * D;
      const len = C * C + D * D;
      let t = len ? dot / len : 0;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * C;
      const pz = a.z + t * D;
      const d = Math.hypot(x - px, z - pz);
      if (d < mn) { mn = d; nombre = r.n; }
    }
  }
  return mn < 16 ? nombre : null;
}

// ───────────────────────────────────────────────────────────────
// Detector de clicks: raycast desde cámara contra mallas de edificios
// ───────────────────────────────────────────────────────────────

function ClickEdificios({
  escena,
  avatarRef,
  onSeleccionarEdificio,
}: {
  escena: Escena3D;
  avatarRef: React.MutableRefObject<THREE.Vector3>;
  onSeleccionarEdificio: (e: EdifMesh) => void;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onClick = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      // Filtro: solo edificios cercanos al avatar (perf + lógica de juego).
      const ax = avatarRef.current.x;
      const az = avatarRef.current.z;
      const cercanos = escena.edificios.filter((e) => {
        const dx = e.cxz[0] - ax;
        const dz = e.cxz[1] - az;
        return Math.hypot(dx, dz) < 60;
      });
      let mejor: { e: EdifMesh; t: number } | null = null;
      const tmpMesh = new THREE.Mesh();
      for (const e of cercanos) {
        tmpMesh.geometry = e.geometry;
        tmpMesh.matrix.identity();
        tmpMesh.matrixWorld.identity();
        tmpMesh.updateMatrixWorld(true);
        const hits = ray.intersectObject(tmpMesh, false);
        if (hits.length && (!mejor || hits[0].distance < mejor.t)) {
          mejor = { e, t: hits[0].distance };
        }
      }
      if (mejor) {
        const dist = distEdifMin(ax, az, mejor.e.xz);
        if (dist <= RADIO_ANOTABLE) {
          onSeleccionarEdificio(mejor.e);
        }
        // Si está fuera del aro, podríamos disparar un walk-to. Por ahora solo dentro.
      }
    };
    gl.domElement.addEventListener("click", onClick);
    return () => gl.domElement.removeEventListener("click", onClick);
  }, [camera, gl, escena, avatarRef, onSeleccionarEdificio]);
  return null;
}

// ───────────────────────────────────────────────────────────────
// Joystick virtual (HTML overlay)
// ───────────────────────────────────────────────────────────────

function JoystickVirtual({
  joystick,
}: {
  joystick: React.MutableRefObject<{ x: number; z: number }>;
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  useEffect(() => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    if (!stick || !knob) return;
    const release = (ev: PointerEvent) => {
      if (active.current !== ev.pointerId) return;
      active.current = null;
      knob.style.transform = "translate(-50%,-50%)";
      joystick.current.x = 0;
      joystick.current.z = 0;
    };
    const move = (ev: PointerEvent) => {
      if (active.current !== ev.pointerId) return;
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = ev.clientX - cx;
      let dy = ev.clientY - cy;
      const max = r.width * 0.35;
      const m = Math.hypot(dx, dy);
      if (m > max) { dx = dx * max / m; dy = dy * max / m; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m2 = Math.hypot(dx, dy) / max;
      if (m2 < 0.12) { joystick.current.x = 0; joystick.current.z = 0; return; }
      // En mundo, +Z = sur (lejos de cámara), +X = este (derecha).
      // En pantalla, +Y = abajo. Mapear directo.
      const ang = Math.atan2(dy, dx);
      joystick.current.x = Math.cos(ang) * Math.min(1, m2);
      joystick.current.z = Math.sin(ang) * Math.min(1, m2);
    };
    const start = (ev: PointerEvent) => {
      active.current = ev.pointerId;
      stick.setPointerCapture(ev.pointerId);
      move(ev);
    };
    stick.addEventListener("pointerdown", start);
    stick.addEventListener("pointermove", move);
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
    return () => {
      stick.removeEventListener("pointerdown", start);
      stick.removeEventListener("pointermove", move);
      stick.removeEventListener("pointerup", release);
      stick.removeEventListener("pointercancel", release);
    };
  }, [joystick]);

  return (
    <div
      ref={stickRef}
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: "rgba(255,255,255,.45)",
        border: "1px solid rgba(180,131,46,.4)",
        touchAction: "none",
        zIndex: 3,
      }}
    >
      <div
        ref={knobRef}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--color-ocre)",
          border: "1px solid var(--color-ocre-deep)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// silenciar imports unused-friendly
void Stats;
