import dynamic from "next/dynamic";

// Types redeclared here so this file never imports from LeafletMapInner
// (which pulls in leaflet CSS and would break SSR resolution)
export type Waypoint = {
  lat: number;
  lon: number;
  label: string;
  isHome?: boolean;
};

export interface LeafletMapProps {
  waypoints: Waypoint[];
  route?: { type: "LineString"; coordinates: [number, number][] };
  height?: number;
  fitBounds?: boolean;
}

const LeafletMap = dynamic(() => import("./LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-xl flex items-center justify-center bg-gray-50"
      style={{ height: 400, border: "1px solid #e5e5e5" }}
    >
      <span style={{ color: "#888780", fontSize: 13 }}>Cargando mapa…</span>
    </div>
  ),
});

export default LeafletMap;
