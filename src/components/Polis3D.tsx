"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ── Building data: 48 buildings from section 3501603006 (Santa Catalina) ──
   Format: [coords_int[], floors, hasRealData]
   Coords offset: real_lng = x/1e5 + (-15.44), real_lat = y/1e5 + 28.135
   We convert to meters centered at 0,0 for the 3D scene */

const RAW: [number[][], number, number][] = [
  [[[893,73],[945,76],[946,60],[894,57],[893,73]],6,0],
  [[[926,185],[927,171],[936,171],[935,186],[926,185]],2,0],
  [[[927,171],[928,163],[936,164],[936,171],[927,171]],2,0],
  [[[936,164],[944,164],[943,172],[936,171],[936,164]],2,0],
  [[[928,163],[928,159],[937,159],[936,164],[928,163]],4,0],
  [[[937,159],[944,160],[944,164],[936,164],[937,159]],4,0],
  [[[889,146],[890,132],[911,133],[910,147],[889,146]],3,0],
  [[[889,146],[889,154],[910,155],[910,147],[889,146]],3,0],
  [[[889,154],[888,161],[909,162],[910,155],[889,154]],3,0],
  [[[888,161],[900,162],[900,168],[888,167],[888,161]],2,0],
  [[[888,167],[887,183],[899,184],[900,168],[888,167]],2,0],
  [[[899,184],[908,184],[909,162],[900,162],[900,168],[899,184]],3,0],
  [[[926,185],[912,184],[916,134],[949,136],[947,160],[944,160],[937,159],[928,159],[928,163],[927,171],[926,185]],1,0],
  [[[964,151],[965,139],[967,137],[1033,140],[1025,155],[964,151]],2,0],
  [[[852,180],[854,165],[867,166],[868,149],[879,149],[878,178],[873,182],[852,180]],2,0],
  [[[852,180],[833,179],[836,147],[855,148],[854,165],[852,180]],2,0],
  [[[879,149],[880,131],[864,130],[863,148],[868,149],[879,149]],2,0],
  [[[836,147],[837,129],[845,129],[843,147],[836,147]],2,0],
  [[[845,129],[854,130],[853,148],[843,147],[845,129]],2,0],
  [[[853,148],[855,148],[863,148],[864,130],[854,130],[853,148]],3,0],
  [[[966,117],[965,127],[968,129],[973,129],[974,118],[966,117]],3,0],
  [[[966,117],[967,104],[989,105],[988,119],[974,118],[966,117]],3,0],
  [[[967,104],[968,93],[971,90],[1012,92],[1011,106],[1011,106],[1000,106],[999,106],[989,105],[967,104]],2,0],
  [[[973,129],[998,131],[998,119],[988,119],[974,118],[973,129]],3,0],
  [[[998,131],[998,119],[999,106],[1000,106],[1000,110],[1010,110],[1011,106],[1011,106],[1015,107],[1015,108],[1014,123],[1013,132],[998,131]],2,0],
  [[[1013,132],[1034,133],[1037,132],[1040,125],[1014,123],[1013,132]],2,0],
  [[[1040,125],[1048,111],[1015,108],[1014,123],[1040,125]],1,0],
  [[[891,125],[892,110],[904,111],[904,126],[891,125]],2,0],
  [[[904,126],[914,126],[914,111],[904,111],[904,126]],2,0],
  [[[914,126],[924,127],[925,111],[914,111],[914,126]],2,0],
  [[[924,127],[936,127],[936,112],[925,111],[924,127]],1,0],
  [[[936,127],[951,128],[952,112],[936,112],[936,127]],2,0],
  [[[892,110],[892,98],[915,99],[914,111],[904,111],[892,110]],2,0],
  [[[892,98],[892,88],[895,85],[915,87],[915,99],[892,98]],2,0],
  [[[914,111],[915,99],[915,87],[926,87],[925,111],[914,111]],3,0],
  [[[926,87],[937,88],[937,101],[936,112],[925,111],[926,87]],3,0],
  [[[936,112],[937,101],[952,102],[952,112],[936,112]],2,0],
  [[[937,101],[937,88],[953,89],[952,102],[937,101]],2,0],
  [[[882,105],[881,112],[874,112],[871,112],[862,111],[862,105],[862,103],[882,105]],2,0],
  [[[839,103],[840,83],[884,85],[882,105],[862,103],[862,105],[856,104],[849,104],[843,104],[839,103]],2,0],
  [[[881,124],[881,112],[874,112],[874,113],[871,113],[871,123],[881,124]],2,0],
  [[[871,123],[861,122],[862,111],[871,112],[871,113],[871,123]],2,0],
  [[[861,122],[854,122],[855,116],[855,115],[855,110],[856,107],[856,104],[862,105],[862,111],[861,122]],4,0],
  [[[854,122],[848,122],[849,104],[856,104],[856,107],[855,107],[854,110],[855,110],[855,115],[853,115],[853,116],[855,116],[854,122]],2,0],
  [[[848,122],[842,121],[842,114],[844,115],[844,112],[843,112],[843,104],[849,104],[848,122]],3,0],
  [[[842,121],[839,121],[838,120],[839,103],[843,104],[843,112],[842,114],[842,121]],2,0],
  [[[970,66],[970,68],[969,76],[973,76],[974,65],[970,65],[970,66]],3,0],
  [[[962,168],[962,169],[976,169],[976,169],[978,170],[985,170],[987,170],[988,170],[988,169],[991,169],[991,170],[992,170],[998,171],[1000,171],[1014,172],[1016,172],[1017,170],[1018,167],[1020,165],[1021,163],[1021,161],[1023,159],[1024,156],[1025,154],[1024,154],[1021,154],[1015,154],[1014,154],[1011,153],[1007,153],[1004,153],[1001,153],[996,152],[993,152],[993,154],[989,153],[988,153],[988,152],[986,152],[982,152],[978,151],[978,151],[972,151],[968,151],[967,151],[967,151],[964,150],[963,150],[963,151],[963,151],[963,151],[962,168],[962,168]],2,0],
];

const FLOOR_H = 3.2; // meters per floor
const SCALE = 0.9; // coord units to meters (approx)

// Colors — warm flat palette per floor level
const WALL_COLORS = [
  "#8B6914", "#9B7424", "#A67F30", "#B08A3C",
  "#BA9548", "#C4A054", "#CEAB60",
];
const ROOF_COLORS = [
  "#C4A060", "#CEAB6A", "#D8B674", "#E2C17E",
  "#ECCC88", "#F0D090", "#F4DA9A",
];

type BuildingData = {
  shape: THREE.Shape;
  floors: number;
  cx: number;
  cy: number;
};

function parseBuildings(): BuildingData[] {
  // Find bounds to center the scene
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (const b of RAW) {
    for (const c of b[0]) {
      if (c[0] < mnx) mnx = c[0];
      if (c[0] > mxx) mxx = c[0];
      if (c[1] < mny) mny = c[1];
      if (c[1] > mxy) mxy = c[1];
    }
  }
  const ox = (mnx + mxx) / 2;
  const oy = (mny + mxy) / 2;

  return RAW.map(([coords, floors]) => {
    const shape = new THREE.Shape();
    const pts = coords.map(([x, y]) => [
      (x - ox) * SCALE,
      (y - oy) * SCALE,
    ]);
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i][0], pts[i][1]);
    }
    shape.closePath();
    return {
      shape,
      floors,
      cx: pts.reduce((s, p) => s + p[0], 0) / pts.length,
      cy: pts.reduce((s, p) => s + p[1], 0) / pts.length,
    };
  });
}

/* ── Single floor mesh: extruded polygon ── */
function FloorMesh({
  shape,
  floorIndex,
  totalFloors,
}: {
  shape: THREE.Shape;
  floorIndex: number;
  totalFloors: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: FLOOR_H - 0.3,
      bevelEnabled: false,
    });
    return g;
  }, [shape]);

  const wallColor = WALL_COLORS[Math.min(floorIndex, WALL_COLORS.length - 1)];
  const roofColor = ROOF_COLORS[Math.min(floorIndex, ROOF_COLORS.length - 1)];
  const isTop = floorIndex === totalFloors - 1;

  return (
    <group position={[0, floorIndex * FLOOR_H, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geo}>
        <meshStandardMaterial
          color={isTop ? roofColor : wallColor}
          flatShading
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color="#5a4020" opacity={0.3} transparent />
      </lineSegments>
    </group>
  );
}

/* ── One building = stack of floors ── */
function Building({ data }: { data: BuildingData }) {
  const [hovered, setHovered] = useState(false);
  const floors = [];
  for (let i = 0; i < data.floors; i++) {
    floors.push(
      <FloorMesh
        key={i}
        shape={data.shape}
        floorIndex={i}
        totalFloors={data.floors}
      />,
    );
  }
  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {floors}
      {hovered && (
        <group position={[0, data.floors * FLOOR_H + 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <circleGeometry args={[2, 16]} />
            <meshBasicMaterial color="#f0c040" opacity={0.6} transparent />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ── Ground plane ── */
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#1a1510" />
    </mesh>
  );
}

/* ── Scene contents ── */
function Scene() {
  const buildings = useMemo(() => parseBuildings(), []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[50, 80, 30]} intensity={1.2} castShadow />
      <directionalLight position={[-30, 40, -20]} intensity={0.3} />
      <Ground />
      {buildings.map((b, i) => (
        <Building key={i} data={b} />
      ))}
      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={20}
        maxDistance={200}
        target={[0, 5, 0]}
      />
    </>
  );
}

/* ── Exported component ── */
export function Polis3D() {
  return (
    <div
      style={{
        width: "100%",
        height: "75vh",
        minHeight: 500,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--color-linea)",
        background: "#0a0a0a",
        position: "relative",
      }}
    >
      <Canvas
        camera={{ position: [60, 50, 60], fov: 45, near: 0.1, far: 1000 }}
        style={{ background: "#0a0a0a" }}
      >
        <Scene />
      </Canvas>
      {/* Data overlay panel */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(10,10,10,0.92)",
          border: "1px solid #333",
          borderRadius: 10,
          padding: 14,
          color: "#e0e0e0",
          fontSize: 12,
          backdropFilter: "blur(8px)",
          zIndex: 10,
          maxWidth: 240,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#f0c040",
            letterSpacing: 1,
          }}
        >
          K0IN0S POLIS
        </div>
        <div
          style={{
            color: "#666",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          D03 · Santa Catalina · S006
        </div>
        <div style={{ color: "#aaa", lineHeight: 1.7 }}>
          <b style={{ color: "#f0c040" }}>48</b> edificios ·{" "}
          <b style={{ color: "#f0c040" }}>6</b> plantas máx
          <br />
          <span style={{ fontSize: 10, color: "#555" }}>
            Clic izq. rotar · Scroll zoom · Clic der. pan
          </span>
        </div>
      </div>
    </div>
  );
}
