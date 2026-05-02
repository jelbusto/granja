"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProduccionRow = {
  fecha: string;
  id_granja: string;
  nombre_granja: string;
  vacas_lactantes: number;
  vacas_secas: number;
  novillas: number;
  litros_tanque: number;
  litros_adicionales: number;
  litros_totales: number;
  litros_por_vaca: number;
  calidad_mg: number;
  calidad_mp: number;
  calidad_bact: number;
  calidad_ccs: number;
  calidad_urea: number;
};

type GranjaOption = { id: string; nombre: string; weather_station_id: string | null };
type StationOption = { id: string; code: string; name: string };
type WeatherRow = { fecha: string; tmax: number | null; tmin: number | null };

const DEFAULT_STATION_CODE = "0370E";

type Objetivos = {
  litros_vaca_dia: number | null;
  calidad_mg_min:  number | null;
  calidad_mp_min:  number | null;
  calidad_ccs_max: number | null;
  calidad_bact_max: number | null;
  calidad_urea_min: number | null;
  calidad_urea_max: number | null;
};

const OBJ_DEFAULT: Required<Objetivos> = {
  litros_vaca_dia:  25,
  calidad_mg_min:   3.5,
  calidad_mp_min:   3.0,
  calidad_ccs_max:  250,
  calidad_bact_max: 50,
  calidad_urea_min: 200,
  calidad_urea_max: 300,
};

function obj<K extends keyof Objetivos>(o: Objetivos | null, key: K): number {
  return (o?.[key] ?? OBJ_DEFAULT[key]) as number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: 7,  label: "Últimos 7 días"  },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
];
const AXIS = { fill: "#888780", fontSize: 10 };

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeRow(row: Record<string, unknown>): ProduccionRow {
  return {
    fecha:              String(row.fecha ?? ""),
    id_granja:          String(row.id_granja ?? ""),
    nombre_granja:      String(row.nombre_granja ?? ""),
    vacas_lactantes:    Number(row.vacas_lactantes)    || 0,
    vacas_secas:        Number(row.vacas_secas)         || 0,
    novillas:           Number(row.novillas)             || 0,
    litros_tanque:      Number(row.litros_tanque)        || 0,
    litros_adicionales: Number(row.litros_adicionales)   || 0,
    litros_totales:     Number(row.litros_totales)       || 0,
    litros_por_vaca:    Number(row.litros_por_vaca)      || 0,
    calidad_mg:         Number(row.calidad_mg)            || 0,
    calidad_mp:         Number(row.calidad_mp)            || 0,
    calidad_bact:       Number(row.calidad_bact)          || 0,
    calidad_ccs:        Number(row.calidad_ccs)           || 0,
    calidad_urea:       Number(row.calidad_urea)          || 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  const clean = arr.filter((v) => !isNaN(v) && isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
}

function avgOrNull(arr: number[]): number | null {
  const clean = arr.filter((v) => !isNaN(v) && isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

function total(arr: number[]): number {
  return arr.filter((v) => !isNaN(v) && isFinite(v)).reduce((a, b) => a + b, 0);
}

function fmt(n: number | null | undefined, dec = 0): string {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return "—";
  return n.toLocaleString("es", { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function isoFrom(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().split("T")[0];
}

function fmtRange(days: number): string {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${start.toLocaleDateString("es", opts)} – ${end.toLocaleDateString("es", { ...opts, year: "numeric" })}`;
}

// ─── Presentational components ────────────────────────────────────────────────

function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 mb-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <svg width="16" height="10" className="flex-shrink-0">
            {item.dashed ? (
              <line x1="0" y1="5" x2="16" y2="5" stroke={item.color} strokeWidth="1.5" strokeDasharray="4 2" />
            ) : (
              <rect width="16" height="10" rx="2" fill={item.color} />
            )}
          </svg>
          <span style={{ color: "#888780", fontSize: 11 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #e5e5e5" }}>
      <h2 className="text-gray-700 mb-3" style={{ fontWeight: 500, fontSize: 13 }}>{title}</h2>
      {children}
    </div>
  );
}

function KpiCard({ label, value, unit, delta }: {
  label: string; value: string; unit: string; delta?: number | null;
}) {
  return (
    <div style={{ backgroundColor: "#f8f7f4", borderRadius: 8 }} className="p-5 flex flex-col items-center text-center">
      <div style={{ color: "#888780", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }} className="mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontSize: 26, fontWeight: 500 }} className="text-gray-900">{value}</span>
        <span style={{ fontSize: 12, color: "#888780" }}>{unit}</span>
      </div>
      {delta !== undefined && delta !== null && (
        <span style={{ fontSize: 11, fontWeight: 500, color: delta >= 0 ? "#3B6D11" : "#A32D2D" }}>
          {delta >= 0 ? "+" : ""}{fmt(delta, 1)} L vs obj.
        </span>
      )}
    </div>
  );
}

function QualityCard({ label, value, unit, ref_label, good, pct, invert }: {
  label: string; value: string; unit: string; ref_label: string;
  good: boolean; pct: number; invert?: boolean;
}) {
  const barColor = good ? "#3B6D11" : "#A32D2D";
  const barPct = Math.min(100, Math.max(0, invert ? 100 - pct : pct));
  return (
    <div className="flex flex-col items-center text-center">
      <div style={{ color: "#888780", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }} className="mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 500 }} className="text-gray-900">{value}</span>
        <span style={{ fontSize: 11, color: "#888780" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: "#888780" }} className="mt-0.5">ref. {ref_label}</div>
      <div className="mt-2 bg-gray-100 rounded-full overflow-hidden w-full" style={{ height: 3 }}>
        <div style={{ width: `${barPct}%`, backgroundColor: barColor, height: "100%" }} className="rounded-full" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "bueno" | "regular" | "alerta" }) {
  const cfg = {
    bueno:   { bg: "#ECFDF5", color: "#3B6D11", label: "Bueno"   },
    regular: { bg: "#FFFBEB", color: "#B45309", label: "Regular" },
    alerta:  { bg: "#FEF2F2", color: "#A32D2D", label: "Alerta"  },
  }[status];
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 500 }} className="px-2 py-0.5 rounded-full whitespace-nowrap">
      {cfg.label}
    </span>
  );
}

function TempPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center" style={{ height: 200, color: "#888780", fontSize: 12 }}>
      {message}
    </div>
  );
}

function MetricTd({ value, dec = 0, unit = "", ok, objLabel }: {
  value: number | null; dec?: number; unit?: string; ok: boolean; objLabel: string;
}) {
  return (
    <td className="py-3 px-3 text-right align-top">
      <div>
        {value != null ? (
          <span style={{ fontSize: 13, fontWeight: 500, color: ok ? "#3B6D11" : "#A32D2D" }}>
            {fmt(value, dec)}{unit}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "#9ca3af" }}>—</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, whiteSpace: "nowrap" }}>
        obj {objLabel}
      </div>
    </td>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [granjas,            setGranjas]           = useState<GranjaOption[]>([]);
  const [stations,           setStations]          = useState<StationOption[]>([]);
  const [selectedGranja,     setSelectedGranja]    = useState("todas");
  const [period,             setPeriod]            = useState(30);
  const [rows,               setRows]              = useState<ProduccionRow[]>([]);
  const [weatherRows,        setWeatherRows]       = useState<WeatherRow[]>([]);
  const [weatherStationName, setWeatherStationName] = useState("");
  const [objetivos,          setObjetivos]         = useState<Objetivos | null>(null);
  const [allObjetivos,       setAllObjetivos]      = useState<Map<string, Objetivos>>(new Map());
  const [loading,            setLoading]           = useState(true);

  // Load farm list and station list
  useEffect(() => {
    supabase
      .from("granjas")
      .select("id, nombre, weather_station_id")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setGranjas((data as GranjaOption[]) ?? []));

    supabase
      .from("weather_stations")
      .select("id, code, name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setStations((data as StationOption[]) ?? []));

    supabase
      .from("objetivos_granja")
      .select("id_granja,litros_vaca_dia,calidad_mg_min,calidad_mp_min,calidad_ccs_max,calidad_bact_max,calidad_urea_min,calidad_urea_max")
      .then(({ data }) => {
        const m = new Map<string, Objetivos>();
        for (const r of (data ?? [])) m.set(r.id_granja, r as Objetivos);
        setAllObjetivos(m);
      });
  }, [supabase]);

  // Load production data
  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("v_produccion_diaria")
      .select("*")
      .gte("fecha", isoFrom(period))
      .order("fecha");

    if (selectedGranja !== "todas") q = q.eq("id_granja", selectedGranja);

    q.then(({ data }: { data: Record<string, unknown>[] | null }) => {
      setRows((data ?? []).map(normalizeRow));
      setLoading(false);
    });
  }, [supabase, selectedGranja, period]);

  // Load objectives for selected farm
  useEffect(() => {
    if (selectedGranja === "todas") { setObjetivos(null); return; }
    supabase
      .from("objetivos_granja")
      .select("litros_vaca_dia,calidad_mg_min,calidad_mp_min,calidad_ccs_max,calidad_bact_max,calidad_urea_min,calidad_urea_max")
      .eq("id_granja", selectedGranja)
      .maybeSingle()
      .then(({ data }) => setObjetivos((data as Objetivos | null) ?? null));
  }, [supabase, selectedGranja]);

  // Load weather data — uses farm's station or falls back to Girona Parc Migdia
  useEffect(() => {
    if (!stations.length) return;

    let stationId: string | null = null;
    let stationName = "";

    if (selectedGranja === "todas") {
      const def = stations.find((s) => s.code === DEFAULT_STATION_CODE);
      stationId   = def?.id   ?? null;
      stationName = def?.name ?? "";
    } else {
      const granja = granjas.find((g) => g.id === selectedGranja);
      stationId    = granja?.weather_station_id ?? null;
      if (stationId) {
        stationName = stations.find((s) => s.id === stationId)?.name ?? "";
      }
    }

    setWeatherStationName(stationName);

    if (!stationId) { setWeatherRows([]); return; }

    supabase
      .from("daily_weather_readings")
      .select("reading_date, temp_max_c, temp_min_c")
      .eq("weather_station_id", stationId)
      .gte("reading_date", isoFrom(period))
      .order("reading_date")
      .then(({ data }) => {
        setWeatherRows(
          (data ?? []).map((r: Record<string, unknown>) => ({
            fecha: String(r.reading_date),
            tmax:  r.temp_max_c != null ? Number(r.temp_max_c) : null,
            tmin:  r.temp_min_c != null ? Number(r.temp_min_c) : null,
          }))
        );
      });
  }, [supabase, selectedGranja, period, granjas, stations]);

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const litrosTotales  = total(rows.map((r) => r.litros_totales));
    const diasConDatos   = new Set(rows.map((r) => r.fecha)).size || 1;
    return {
      litrosDiarios:   litrosTotales / diasConDatos,
      mediaLitrosVaca: avg(rows.map((r) => r.litros_por_vaca)),
      mediaVacasLact:  avg(rows.map((r) => r.vacas_lactantes)),
      mediaCCS:        avg(rows.map((r) => r.calidad_ccs)),
      mediaMG:         avg(rows.map((r) => r.calidad_mg)),
      mediaMP:         avg(rows.map((r) => r.calidad_mp)),
      mediaBact:       avg(rows.map((r) => r.calidad_bact)),
      mediaUrea:       avg(rows.map((r) => r.calidad_urea)),
    };
  }, [rows]);

  // ── Daily chart data (production + weather merged by date) ────────────────

  const dailyData = useMemo(() => {
    const weatherMap = new Map(weatherRows.map((w) => [w.fecha, w]));

    const map = new Map<string, {
      litros: number; lvVals: number[]; mgVals: number[]; mpVals: number[];
    }>();

    for (const r of rows) {
      if (!map.has(r.fecha)) map.set(r.fecha, { litros: 0, lvVals: [], mgVals: [], mpVals: [] });
      const e = map.get(r.fecha)!;
      e.litros += r.litros_totales;
      if (r.litros_por_vaca) e.lvVals.push(r.litros_por_vaca);
      if (r.calidad_mg)      e.mgVals.push(r.calidad_mg);
      if (r.calidad_mp)      e.mpVals.push(r.calidad_mp);
    }

    const allDates = new Set([...Array.from(map.keys()), ...Array.from(weatherMap.keys())]);

    return Array.from(allDates).sort().map((fecha) => {
      const v = map.get(fecha);
      const w = weatherMap.get(fecha);
      return {
        fecha:  fecha.slice(5),
        litros: v?.litros || null,
        lv:     v ? avg(v.lvVals)  || null : null,
        mg:     v ? avg(v.mgVals)  || null : null,
        mp:     v ? avg(v.mpVals)  || null : null,
        tmax:   w?.tmax ?? null,
        tmin:   w?.tmin ?? null,
      };
    });
  }, [rows, weatherRows]);

  // ── Per-granja comparison ─────────────────────────────────────────────────

  const granjaChart = useMemo(() => {
    const map = new Map<string, { nombre: string; lvVals: number[] }>();
    for (const r of rows) {
      if (!map.has(r.id_granja)) map.set(r.id_granja, { nombre: r.nombre_granja, lvVals: [] });
      if (r.litros_por_vaca) map.get(r.id_granja)!.lvVals.push(r.litros_por_vaca);
    }
    return Array.from(map.values())
      .map((v) => ({ nombre: v.nombre, lv: avg(v.lvVals) || null }))
      .sort((a, b) => (b.lv ?? 0) - (a.lv ?? 0));
  }, [rows]);

  // ── Summary table ─────────────────────────────────────────────────────────

  const tableRows = useMemo(() => {
    const map = new Map<string, {
      nombre: string;
      lvVals: number[]; mgVals: number[]; mpVals: number[];
      ccsVals: number[]; bactVals: number[]; ureaVals: number[];
    }>();

    for (const r of rows) {
      if (!map.has(r.id_granja)) {
        map.set(r.id_granja, {
          nombre: r.nombre_granja,
          lvVals: [], mgVals: [], mpVals: [],
          ccsVals: [], bactVals: [], ureaVals: [],
        });
      }
      const e = map.get(r.id_granja)!;
      if (r.litros_por_vaca) e.lvVals.push(r.litros_por_vaca);
      if (r.calidad_mg)      e.mgVals.push(r.calidad_mg);
      if (r.calidad_mp)      e.mpVals.push(r.calidad_mp);
      if (r.calidad_ccs)     e.ccsVals.push(r.calidad_ccs);
      if (r.calidad_bact)    e.bactVals.push(r.calidad_bact);
      if (r.calidad_urea)    e.ureaVals.push(r.calidad_urea);
    }

    return Array.from(map.entries()).map(([id_granja, v]) => {
      const granjaObj = allObjetivos.get(id_granja) ?? null;

      const mediaLv   = avgOrNull(v.lvVals);
      const mediaMG   = avgOrNull(v.mgVals);
      const mediaMP   = avgOrNull(v.mpVals);
      const mediaCCS  = avgOrNull(v.ccsVals);
      const mediaBact = avgOrNull(v.bactVals);
      const mediaUrea = avgOrNull(v.ureaVals);

      const lvOk   = mediaLv   != null && mediaLv  >= obj(granjaObj, "litros_vaca_dia");
      const mgOk   = mediaMG   != null && mediaMG  >= obj(granjaObj, "calidad_mg_min");
      const mpOk   = mediaMP   != null && mediaMP  >= obj(granjaObj, "calidad_mp_min");
      const ccsOk  = mediaCCS  != null && mediaCCS  < obj(granjaObj, "calidad_ccs_max");
      const bactOk = mediaBact != null && mediaBact < obj(granjaObj, "calidad_bact_max");
      const ureaOk = mediaUrea != null && mediaUrea >= obj(granjaObj, "calidad_urea_min") && mediaUrea <= obj(granjaObj, "calidad_urea_max");

      const okCount = [lvOk, mgOk, mpOk, ccsOk, bactOk, ureaOk].filter(Boolean).length;
      const status: "bueno" | "regular" | "alerta" =
        okCount >= 5 ? "bueno" :
        okCount >= 3 ? "regular" :
                       "alerta";

      return {
        nombre: v.nombre,
        mediaLv,  mediaMG,  mediaMP,  mediaCCS,  mediaBact,  mediaUrea,
        lvOk,     mgOk,     mpOk,     ccsOk,     bactOk,     ureaOk,
        objLv:       obj(granjaObj, "litros_vaca_dia"),
        objMG:       obj(granjaObj, "calidad_mg_min"),
        objMP:       obj(granjaObj, "calidad_mp_min"),
        objCCS:      obj(granjaObj, "calidad_ccs_max"),
        objBact:     obj(granjaObj, "calidad_bact_max"),
        objUreaMin:  obj(granjaObj, "calidad_urea_min"),
        objUreaMax:  obj(granjaObj, "calidad_urea_max"),
        status,
      };
    }).sort((a, b) => (b.mediaLv ?? 0) - (a.mediaLv ?? 0));
  }, [rows, allObjetivos]);

  // ── Temperature chart status ──────────────────────────────────────────────

  const tempStatus = useMemo(() => {
    if (selectedGranja !== "todas") {
      const granja = granjas.find((g) => g.id === selectedGranja);
      if (!granja?.weather_station_id) return "no_estacion";
    }
    if (weatherRows.length === 0) return "sin_datos";
    return "ok";
  }, [selectedGranja, granjas, weatherRows]);

  const delta = kpis ? kpis.mediaLitrosVaca - obj(objetivos, "litros_vaca_dia") : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-7xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 style={{ fontWeight: 500, fontSize: 22 }} className="text-gray-900">Dashboard granjas</h1>
          <p style={{ color: "#888780", fontSize: 13 }} className="mt-0.5">{fmtRange(period)}</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedGranja}
            onChange={(e) => setSelectedGranja(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="todas">Todas las granjas</option>
            {granjas.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64" style={{ color: "#888780" }}>Cargando…</div>
      ) : !kpis ? (
        <div className="flex items-center justify-center h-64" style={{ color: "#888780" }}>Sin datos para el período seleccionado</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Litros diarios"        value={fmt(kpis.litrosDiarios)}      unit="L/día" />
            <KpiCard label="Media L/vaca/día"      value={fmt(kpis.mediaLitrosVaca, 1)} unit="L" delta={delta} />
            <KpiCard label="Media vacas lactantes" value={fmt(kpis.mediaVacasLact, 0)}  unit="cab." />
            <KpiCard label="Media CCS"             value={fmt(kpis.mediaCCS, 0)}        unit="mil/ml" />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

            <ChartCard title="Producción diaria">
              <Legend items={[{ color: "#BA7517", label: "L/vaca/día" }]} />
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="fecha" tick={AXIS} />
                  <YAxis tick={AXIS} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="lv" name="L/vaca" stroke="#BA7517" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Calidad de leche">
              <Legend items={[
                { color: "#378ADD", label: "MG %" },
                { color: "#D85A30", label: "MP %", dashed: true },
              ]} />
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="fecha" tick={AXIS} />
                  <YAxis tick={AXIS} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="mg" name="MG %" stroke="#378ADD" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="mp" name="MP %" stroke="#D85A30" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`Temperatura${weatherStationName ? ` — ${weatherStationName}` : ""}`}>
              {tempStatus === "no_estacion" ? (
                <TempPlaceholder message="Esta granja no tiene estación meteorológica asignada" />
              ) : tempStatus === "sin_datos" ? (
                <TempPlaceholder message="Sin datos meteorológicos para este período" />
              ) : (
                <>
                  <Legend items={[
                    { color: "#E24B4A", label: "T. máxima" },
                    { color: "#378ADD", label: "T. mínima", dashed: true },
                  ]} />
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="fecha" tick={AXIS} />
                      <YAxis tick={AXIS} unit="°" domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => `${v} °C`} />
                      <Line type="monotone" dataKey="tmax" name="Tmax" stroke="#E24B4A" strokeWidth={1.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="tmin" name="Tmin" stroke="#378ADD" strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </ChartCard>

            <ChartCard title="Comparativa granjas — L/vaca/día">
              <Legend items={[{ color: "#1D9E75", label: "Media L/vaca/día" }]} />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={granjaChart} layout="vertical" margin={{ top: 4, right: 16, left: 90, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
                  <XAxis type="number" tick={AXIS} />
                  <YAxis type="category" dataKey="nombre" tick={{ ...AXIS, width: 85 }} width={88} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="lv" name="L/vaca/día" fill="#1D9E75" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Calidad media del período */}
          <div className="bg-white rounded-xl p-5 mb-4" style={{ border: "1px solid #e5e5e5" }}>
            <h2 className="text-gray-800 mb-5" style={{ fontWeight: 500, fontSize: 14 }}>Calidad media del período</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              <QualityCard
                label="MG" value={fmt(kpis.mediaMG, 2)} unit="%"
                ref_label={`>${obj(objetivos,"calidad_mg_min")}%`}
                good={kpis.mediaMG >= obj(objetivos,"calidad_mg_min")}
                pct={Math.min(100, (kpis.mediaMG / 5) * 100)}
              />
              <QualityCard
                label="MP" value={fmt(kpis.mediaMP, 2)} unit="%"
                ref_label={`>${obj(objetivos,"calidad_mp_min")}%`}
                good={kpis.mediaMP >= obj(objetivos,"calidad_mp_min")}
                pct={Math.min(100, (kpis.mediaMP / 5) * 100)}
              />
              <QualityCard
                label="CCS" value={fmt(kpis.mediaCCS, 0)} unit="mil/ml"
                ref_label={`<${obj(objetivos,"calidad_ccs_max")}`}
                good={kpis.mediaCCS > 0 && kpis.mediaCCS < obj(objetivos,"calidad_ccs_max")}
                pct={Math.min(100, (kpis.mediaCCS / (obj(objetivos,"calidad_ccs_max") * 2)) * 100)}
                invert
              />
              <QualityCard
                label="Bacteriología" value={fmt(kpis.mediaBact, 0)} unit="UFC/ml"
                ref_label={`<${obj(objetivos,"calidad_bact_max")} UFC/ml`}
                good={kpis.mediaBact > 0 && kpis.mediaBact < obj(objetivos,"calidad_bact_max")}
                pct={Math.min(100, (kpis.mediaBact / (obj(objetivos,"calidad_bact_max") * 2)) * 100)}
                invert
              />
              <QualityCard
                label="Urea" value={fmt(kpis.mediaUrea, 0)} unit="mg/L"
                ref_label={`${obj(objetivos,"calidad_urea_min")}–${obj(objetivos,"calidad_urea_max")} mg/L`}
                good={kpis.mediaUrea >= obj(objetivos,"calidad_urea_min") && kpis.mediaUrea <= obj(objetivos,"calidad_urea_max")}
                pct={Math.min(100, (kpis.mediaUrea / (obj(objetivos,"calidad_urea_max") * 1.5)) * 100)}
              />
            </div>
          </div>

          {/* Tabla resumen por granja */}
          <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #e5e5e5" }}>
            <h2 className="text-gray-800 mb-4" style={{ fontWeight: 500, fontSize: 14 }}>Resumen por granja</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "#888780", fontSize: 11 }}>
                    {["Granja", "L/vaca/día", "MG %", "MP %", "CCS", "Bact.", "Urea", "Estado"].map((col, i) => (
                      <th key={col} className={`pb-3 font-medium uppercase tracking-wider ${i === 0 ? "text-left pr-4" : "text-right px-3"}`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-3 pr-4 text-gray-800" style={{ fontWeight: 500 }}>{row.nombre}</td>
                      <MetricTd value={row.mediaLv}   dec={1} unit=" L" ok={row.lvOk}   objLabel={`≥${fmt(row.objLv, 1)} L`} />
                      <MetricTd value={row.mediaMG}   dec={2} unit="%" ok={row.mgOk}   objLabel={`≥${fmt(row.objMG, 2)}%`} />
                      <MetricTd value={row.mediaMP}   dec={2} unit="%" ok={row.mpOk}   objLabel={`≥${fmt(row.objMP, 2)}%`} />
                      <MetricTd value={row.mediaCCS}  dec={0}         ok={row.ccsOk}  objLabel={`<${fmt(row.objCCS, 0)}`} />
                      <MetricTd value={row.mediaBact} dec={0}         ok={row.bactOk} objLabel={`<${fmt(row.objBact, 0)}`} />
                      <MetricTd value={row.mediaUrea} dec={0}         ok={row.ureaOk} objLabel={`${fmt(row.objUreaMin, 0)}–${fmt(row.objUreaMax, 0)}`} />
                      <td className="py-3 pl-3 text-right"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
