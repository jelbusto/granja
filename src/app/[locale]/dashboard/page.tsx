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
  temperatura_max: number;
  temperatura_min: number;
  humedad_max: number;
  humedad_min: number;
};

type GranjaOption = { id: string; nombre: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJETIVO_L_VACA = 25;
const PERIODS = [
  { value: 7,  label: "Últimos 7 días"  },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
];
const AXIS = { fill: "#888780", fontSize: 10 };

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeRow(row: Record<string, unknown>): ProduccionRow {
  return {
    fecha:             String(row.fecha ?? ""),
    id_granja:         String(row.id_granja ?? ""),
    nombre_granja:     String(row.nombre_granja ?? ""),
    vacas_lactantes:   Number(row.vacas_lactantes)   || 0,
    vacas_secas:       Number(row.vacas_secas)        || 0,
    novillas:          Number(row.novillas)            || 0,
    litros_tanque:     Number(row.litros_tanque)       || 0,
    litros_adicionales:Number(row.litros_adicionales)  || 0,
    litros_totales:    Number(row.litros_totales)      || 0,
    litros_por_vaca:   Number(row.litros_por_vaca)     || 0,
    calidad_mg:        Number(row.calidad_mg)           || 0,
    calidad_mp:        Number(row.calidad_mp)           || 0,
    calidad_bact:      Number(row.calidad_bact)         || 0,
    calidad_ccs:       Number(row.calidad_ccs)          || 0,
    calidad_urea:      Number(row.calidad_urea)         || 0,
    temperatura_max:   Number(row.temperatura_max)     || 0,
    temperatura_min:   Number(row.temperatura_min)     || 0,
    humedad_max:       Number(row.humedad_max)         || 0,
    humedad_min:       Number(row.humedad_min)         || 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  const clean = arr.filter((v) => !isNaN(v) && isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [granjas,        setGranjas]        = useState<GranjaOption[]>([]);
  const [selectedGranja, setSelectedGranja] = useState("todas");
  const [period,         setPeriod]         = useState(30);
  const [rows,           setRows]           = useState<ProduccionRow[]>([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    supabase
      .from("granjas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setGranjas((data as GranjaOption[]) ?? []));
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("v_produccion_diaria")
      .select("*")
      .gte("fecha", isoFrom(period))
      .order("fecha");

    if (selectedGranja !== "todas") q = q.eq("id_granja", selectedGranja);

    q.then(({ data }: { data: Record<string, unknown>[] | null }) => {
      if (data?.[0]) {
        console.log("🔍 RAW primera fila de v_produccion_diaria:", data[0]);
        console.log("🔍 Columnas disponibles:", Object.keys(data[0]));
      }
      setRows((data ?? []).map(normalizeRow));
      setLoading(false);
    });
  }, [supabase, selectedGranja, period]);

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    if (!rows.length) return null;
    return {
      litrosTotales:  total(rows.map((r) => r.litros_totales)),
      mediaLitrosVaca: avg(rows.map((r) => r.litros_por_vaca)),
      mediaVacasLact:  avg(rows.map((r) => r.vacas_lactantes)),
      mediaCCS:        avg(rows.map((r) => r.calidad_ccs)),
      mediaMG:         avg(rows.map((r) => r.calidad_mg)),
      mediaMP:         avg(rows.map((r) => r.calidad_mp)),
      mediaBact:       avg(rows.map((r) => r.calidad_bact)),
      mediaUrea:       avg(rows.map((r) => r.calidad_urea)),
    };
  }, [rows]);

  // ── Daily chart data ──────────────────────────────────────────────────────

  const dailyData = useMemo(() => {
    const map = new Map<string, {
      litros: number;
      lvVals: number[]; mgVals: number[]; mpVals: number[];
      tmaxVals: number[]; tminVals: number[];
    }>();

    for (const r of rows) {
      if (!map.has(r.fecha)) {
        map.set(r.fecha, { litros: 0, lvVals: [], mgVals: [], mpVals: [], tmaxVals: [], tminVals: [] });
      }
      const e = map.get(r.fecha)!;
      e.litros += r.litros_totales;
      if (r.litros_por_vaca)  e.lvVals.push(r.litros_por_vaca);
      if (r.calidad_mg)       e.mgVals.push(r.calidad_mg);
      if (r.calidad_mp)       e.mpVals.push(r.calidad_mp);
      if (r.temperatura_max)  e.tmaxVals.push(r.temperatura_max);
      if (r.temperatura_min)  e.tminVals.push(r.temperatura_min);
    }

    return Array.from(map.entries()).map(([fecha, v]) => ({
      fecha: fecha.slice(5),
      litros: v.litros || null,
      lv:   avg(v.lvVals)   || null,
      mg:   avg(v.mgVals)   || null,
      mp:   avg(v.mpVals)   || null,
      tmax: avg(v.tmaxVals) || null,
      tmin: avg(v.tminVals) || null,
    }));
  }, [rows]);

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

  // ── Table data ────────────────────────────────────────────────────────────

  const tableRows = useMemo(() => {
    const map = new Map<string, {
      nombre: string;
      vacLactVals: number[]; litros: number; lvVals: number[];
      totalVacasVals: number[]; mgVals: number[]; ccsVals: number[];
    }>();

    for (const r of rows) {
      if (!map.has(r.id_granja)) {
        map.set(r.id_granja, {
          nombre: r.nombre_granja,
          vacLactVals: [], litros: 0, lvVals: [],
          totalVacasVals: [], mgVals: [], ccsVals: [],
        });
      }
      const e = map.get(r.id_granja)!;
      if (r.vacas_lactantes) e.vacLactVals.push(r.vacas_lactantes);
      e.litros += r.litros_totales;
      if (r.litros_por_vaca) e.lvVals.push(r.litros_por_vaca);
      const totalVacas = r.vacas_lactantes + r.vacas_secas + r.novillas;
      if (totalVacas)        e.totalVacasVals.push(totalVacas);
      if (r.calidad_mg)      e.mgVals.push(r.calidad_mg);
      if (r.calidad_ccs)     e.ccsVals.push(r.calidad_ccs);
    }

    return Array.from(map.values()).map((v) => {
      const mediaVacLact   = avg(v.vacLactVals);
      const mediaLv        = avg(v.lvVals);
      const mediaTotalVacas = avg(v.totalVacasVals);
      const pctLact        = mediaTotalVacas > 0 ? (mediaVacLact / mediaTotalVacas) * 100 : null;
      const mediaMG        = avg(v.mgVals);
      const mediaCCS       = avg(v.ccsVals);
      const status: "bueno" | "regular" | "alerta" =
        mediaLv >= 25 && mediaCCS > 0 && mediaCCS < 250 ? "bueno" :
        mediaLv >= 20                                    ? "regular" :
                                                           "alerta";
      return { nombre: v.nombre, mediaVacLact, litros: v.litros, mediaLv, pctLact, mediaMG, mediaCCS, status };
    });
  }, [rows]);

  const delta = kpis ? kpis.mediaLitrosVaca - OBJETIVO_L_VACA : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 bg-white min-h-screen max-w-7xl">

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
            <KpiCard label="Litros totales"       value={fmt(kpis.litrosTotales)}     unit="L" />
            <KpiCard label="Media L/vaca/día"     value={fmt(kpis.mediaLitrosVaca, 1)} unit="L" delta={delta} />
            <KpiCard label="Media vacas lactantes" value={fmt(kpis.mediaVacasLact, 0)} unit="cab." />
            <KpiCard label="Media CCS"            value={fmt(kpis.mediaCCS, 0)}       unit="mil/ml" />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

            <ChartCard title="Producción diaria">
              <Legend items={[
                { color: "#BA7517", label: "L/vaca/día" },
              ]} />
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

            <ChartCard title="Temperatura">
              <Legend items={[
                { color: "#E24B4A", label: "T. máxima" },
                { color: "#378ADD", label: "T. mínima", dashed: true },
              ]} />
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="fecha" tick={AXIS} />
                  <YAxis tick={AXIS} unit="°" />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="tmax" name="Tmax" stroke="#E24B4A" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="tmin" name="Tmin" stroke="#378ADD" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
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
                label="MG" value={fmt(kpis.mediaMG, 2)} unit="%" ref_label=">3.5%"
                good={kpis.mediaMG >= 3.5}
                pct={Math.min(100, (kpis.mediaMG / 5) * 100)}
              />
              <QualityCard
                label="MP" value={fmt(kpis.mediaMP, 2)} unit="%" ref_label=">3.0%"
                good={kpis.mediaMP >= 3.0}
                pct={Math.min(100, (kpis.mediaMP / 5) * 100)}
              />
              <QualityCard
                label="CCS" value={fmt(kpis.mediaCCS, 0)} unit="mil/ml" ref_label="<250"
                good={kpis.mediaCCS > 0 && kpis.mediaCCS < 250}
                pct={Math.min(100, (kpis.mediaCCS / 500) * 100)}
                invert
              />
              <QualityCard
                label="Bacteriología" value={fmt(kpis.mediaBact, 0)} unit="UFC/ml" ref_label="<50 UFC/ml"
                good={kpis.mediaBact > 0 && kpis.mediaBact < 50}
                pct={Math.min(100, (kpis.mediaBact / 100) * 100)}
                invert
              />
              <QualityCard
                label="Urea" value={fmt(kpis.mediaUrea, 0)} unit="mg/L" ref_label="200–300 mg/L"
                good={kpis.mediaUrea >= 200 && kpis.mediaUrea <= 300}
                pct={Math.min(100, (kpis.mediaUrea / 400) * 100)}
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
                    {["Granja", "Vac. lactantes", "Litros período", "L/vaca/día", "% Lactantes", "MG %", "CCS", "Estado"].map((col, i) => (
                      <th key={col} className={`pb-3 font-medium uppercase tracking-wider ${i === 0 ? "text-left pr-4" : "text-right px-4"}`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-3 pr-4 text-gray-800" style={{ fontWeight: 500 }}>{row.nombre}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{fmt(row.mediaVacLact, 0)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{fmt(row.litros)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{fmt(row.mediaLv, 1)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {row.pctLact !== null ? `${fmt(row.pctLact, 1)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{fmt(row.mediaMG, 2)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{fmt(row.mediaCCS, 0)}</td>
                      <td className="py-3 pl-4 text-right"><StatusBadge status={row.status} /></td>
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
