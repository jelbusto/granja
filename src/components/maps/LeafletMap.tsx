import dynamic from "next/dynamic";
import type { LeafletMapProps } from "./LeafletMapInner";

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

export type { LeafletMapProps };
export default LeafletMap;
