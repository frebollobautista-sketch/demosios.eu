"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORIAS } from "@/lib/pharos/categorias";
import type { UrbanLandmark } from "@/lib/las-palmas-data";
import { LAS_PALMAS_CENTER, LAS_PALMAS_ZOOM } from "@/lib/las-palmas-data";

// ---- types expected from the parent (feed/page.tsx) --------------------

type PoliPin = {
  id: string;
  title: string;
  body: string;
  author: string;
  catId: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
};

type PolisMapProps = {
  pins: PoliPin[];
  landmarks: UrbanLandmark[];
  onPinClick?: (pin: PoliPin) => void;
  onLandmarkClick?: (lm: UrbanLandmark) => void;
  activeCat: string | null;
};

// ---- color per PHAROS category -----------------------------------------

const CAT_COLORS: Record<string, string> = {
  urbanismo: "#FF6B6B",
  movilidad: "#3DBBF0",
  medioambiente: "#2ECC87",
  cultura: "#D4AF37",
  comunidad: "#7C5CFC",
  educacion: "#FFB347",
  "economia-local": "#F97316",
  participacion: "#A855F7",
  bienestar: "#34D399",
  general: "#A89F97",
};

function catColor(catId: string): string {
  return CAT_COLORS[catId] ?? "#7C5CFC";
}

// ---- custom building icon for landmarks --------------------------------

const buildingIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:6px;
    background:#2D2926;color:#D4AF37;
    display:flex;align-items:center;justify-content:center;
    font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);
    border:2px solid #D4AF37;
  ">&#x1F3DB;</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const mercadoIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:32px;height:32px;border-radius:6px;
    background:#D4AF37;color:#2D2926;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;box-shadow:0 3px 8px rgba(212,175,55,0.5);
    border:2px solid #2D2926;font-weight:bold;
  ">&#x1F3EA;</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

// ---- fit bounds helper -------------------------------------------------

function FitBounds({
  pins,
  landmarks,
}: {
  pins: PoliPin[];
  landmarks: UrbanLandmark[];
}) {
  const map = useMap();

  useEffect(() => {
    const pts: [number, number][] = [];
    pins.forEach((p) => {
      if (p.lat != null && p.lng != null) pts.push([p.lat, p.lng]);
    });
    landmarks.forEach((lm) => pts.push(lm.coords));
    if (pts.length > 1) {
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ---- main component ----------------------------------------------------

export default function PolisMap({
  pins,
  landmarks,
  onPinClick,
  onLandmarkClick,
  activeCat,
}: PolisMapProps) {
  const visiblePins = pins.filter((p) => p.lat != null && p.lng != null);

  return (
    <MapContainer
      center={LAS_PALMAS_CENTER}
      zoom={LAS_PALMAS_ZOOM}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds pins={visiblePins} landmarks={landmarks} />

      {/* Civic pins */}
      {visiblePins.map((pin) => {
        const cat = CATEGORIAS.find((c) => c.id === pin.catId);
        return (
          <CircleMarker
            key={pin.id}
            center={[pin.lat!, pin.lng!]}
            radius={10}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: catColor(pin.catId),
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              click: () => onPinClick?.(pin),
            }}
          >
            <Popup maxWidth={260} closeButton={true}>
              <div style={{ fontFamily: "inherit" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: catColor(pin.catId) + "22",
                      color: catColor(pin.catId),
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {cat?.icono} {cat?.nombre}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 3,
                    color: "#2D2926",
                  }}
                >
                  {pin.title}
                </div>
                <div style={{ fontSize: 11, color: "#7A7067", lineHeight: 1.4 }}>
                  {pin.body}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#A89F97",
                    marginTop: 4,
                    fontWeight: 600,
                  }}
                >
                  {pin.author}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Urban landmarks */}
      {landmarks.map((lm) => {
        const isMercado = lm.id === "mercado-vegueta";
        return (
          <Marker
            key={lm.id}
            position={lm.coords}
            icon={isMercado ? mercadoIcon : buildingIcon}
            eventHandlers={{
              click: () => onLandmarkClick?.(lm),
            }}
          >
            <Popup maxWidth={280} closeButton={true}>
              <div style={{ fontFamily: "inherit" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#2D2926",
                    marginBottom: 3,
                  }}
                >
                  {lm.name}
                </div>
                {lm.year && (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#D4AF37",
                      marginBottom: 4,
                    }}
                  >
                    {lm.year}
                    {lm.architect ? ` — ${lm.architect}` : ""}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#7A7067", lineHeight: 1.4 }}>
                  {lm.description}
                </div>
                {isMercado && lm.dimensions && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: "5px 8px",
                      background: "#FAF7F5",
                      borderRadius: 8,
                      fontSize: 10,
                      color: "#7A7067",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: "#2D2926" }}>Dimensiones:</strong>{" "}
                    {lm.dimensions.width}x{lm.dimensions.depth}m, alt.{" "}
                    {lm.dimensions.heightTotal}m
                    <br />
                    <strong style={{ color: "#2D2926" }}>Materiales:</strong>{" "}
                    {lm.materials?.join(", ")}
                    {lm.pixelArtProfile && (
                      <>
                        <br />
                        <span style={{ color: "#D4AF37" }}>
                          Pixel art: {lm.pixelArtProfile}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
