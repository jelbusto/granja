"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LeafletMap from "@/components/maps/LeafletMap";
import type { Waypoint } from "@/components/maps/LeafletMapInner";

type GranjaGeo = {
  id: string;
  nombre: string;
  lat: number | null;
  lon: number | null;
  direccion: string | null;
  poblacion: string | null;
};

export default function GranjasMapa() {
  const supabase = useRef(createClient()).current;
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [sinCoordenadas, setSinCoordenadas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = (await supabase
        .from("granjas" as never)
        .select("id, nombre, lat, lon, direccion, poblacion")
        .eq("activo", true)
        .order("nombre")) as unknown as { data: GranjaGeo[] | null };

      const granjas = data ?? [];
      const withCoords = granjas.filter((g) => g.lat != null && g.lon != null);
      const withoutCoords = granjas.length - withCoords.length;

      setSinCoordenadas(withoutCoords);
      setWaypoints(
        withCoords.map((g) => ({
          lat: g.lat as number,
          lon: g.lon as number,
          label: [g.nombre, g.direccion, g.poblacion].filter(Boolean).join(" — "),
          isHome: false,
        }))
      );
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div
        className="rounded-xl flex items-center justify-center bg-gray-50"
        style={{ height: 400, border: "1px solid #e5e5e5" }}
      >
        <span style={{ color: "#888780", fontSize: 13 }}>Cargando mapa…</span>
      </div>
    );
  }

  return (
    <div>
      {sinCoordenadas > 0 && (
        <p className="mb-3 text-sm" style={{ color: "#888780" }}>
          {sinCoordenadas} granja{sinCoordenadas !== 1 ? "s" : ""} sin coordenadas (no se muestran en el mapa)
        </p>
      )}
      <LeafletMap waypoints={waypoints} height={520} />
    </div>
  );
}
