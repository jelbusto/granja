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

function makeCircleIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const homeIcon = makeCircleIcon("#3B82F6");
const granjaIcon = makeCircleIcon("#22C55E");

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
        <Marker
          key={i}
          position={[w.lat, w.lon]}
          icon={w.isHome ? homeIcon : granjaIcon}
        >
          <Popup>{w.label}</Popup>
        </Marker>
      ))}

      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} color="#3B82F6" weight={3} opacity={0.8} />
      )}
    </MapContainer>
  );
}
