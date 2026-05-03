"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon URLs broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeHomeIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#3B82F6;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 20 20" fill="white"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function makeNumberedIcon(num: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#22C55E;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;font-family:system-ui,sans-serif;">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
  });
}

type Waypoint = {
  lat: number;
  lon: number;
  label: string;
  isHome?: boolean;
};

interface LeafletMapProps {
  waypoints: Waypoint[];
  route?: { type: "LineString"; coordinates: [number, number][] };
  height?: number;
  fitBounds?: boolean;
}

function BoundsController({ waypoints }: { waypoints: Waypoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length === 0) return;
    const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, waypoints]);
  return null;
}

export default function LeafletMapInner({
  waypoints,
  route,
  height = 400,
  fitBounds = true,
}: LeafletMapProps) {
  const center: [number, number] =
    waypoints.length > 0
      ? [
          waypoints.reduce((s, w) => s + w.lat, 0) / waypoints.length,
          waypoints.reduce((s, w) => s + w.lon, 0) / waypoints.length,
        ]
      : [41.98, 2.82];

  const polylinePositions: [number, number][] = route
    ? route.coordinates.map(([lon, lat]) => [lat, lon])
    : [];

  let farmN = 0;
  const icons = waypoints.map((w) =>
    w.isHome ? makeHomeIcon() : makeNumberedIcon(++farmN)
  );

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height, width: "100%", borderRadius: 12 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {fitBounds && waypoints.length > 0 && (
        <BoundsController waypoints={waypoints} />
      )}

      {waypoints.map((w, i) => (
        <Marker key={i} position={[w.lat, w.lon]} icon={icons[i]}>
          <Popup>{w.label}</Popup>
        </Marker>
      ))}

      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} color="#3B82F6" weight={3} opacity={0.8} />
      )}
    </MapContainer>
  );
}
