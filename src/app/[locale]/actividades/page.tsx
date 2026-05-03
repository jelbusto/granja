"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon } from "@/components/ui/Icons";

// ── Types ─────────────────────────────────────────────────────────────────────
type Empleado = { id: string; nombre: string; apellidos: string | null; color: string | null };
type TipoActividad = { id: string; nombre: string };
type Granja = { id: string; nombre: string };

type Activity = {
  id: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  id_tipo: string | null;
  id_granja: string | null;
  descripcion: string | null;
  comentarios: string | null;
  tipo: { nombre: string } | null;
  granja: { nombre: string; direccion: string | null; poblacion: string | null } | null;
  empleados: { id: string; nombre: string; apellidos: string | null; color: string | null }[];
};

type View = "month" | "week" | "day" | "list";

type DistLeg = { from: string; to: string; km: number };
type DistResult = { total: number; legs: DistLeg[]; error?: string };

// ── Date helpers ──────────────────────────────────────────────────────────────
function p2(n: number) { return n.toString().padStart(2, "0"); }
function dateStr(d: Date) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }

function weekStart(d: Date): Date {
  const r = new Date(d);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - offset);
  const rows: Date[][] = [];
  for (let row = 0; row < 6; row++) {
    const week: Date[] = [];
    for (let col = 0; col < 7; col++) {
      const d = new Date(start);
      d.setDate(start.getDate() + row * 7 + col);
      week.push(d);
    }
    rows.push(week);
  }
  return rows;
}

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_H = 60;

function timeToTop(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h - HOUR_START) * HOUR_H + (m / 60) * HOUR_H;
}

function timeToDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * HOUR_H, 20);
}

function actColor(act: Activity): string {
  return act.empleados[0]?.color ?? "#6B7280";
}

function hexToRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

const DAY_NAMES_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── Geocoding & distance ──────────────────────────────────────────────────────
async function geocodeAddress(addr: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`,
      { headers: { "User-Agent": "DairyPro/1.0" } }
    );
    const data = await res.json() as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

// ── Component ─────────────────────────────────────────────────────────────────
export default function ActividadesPage() {
  const supabase = useRef(createClient()).current;
  const today = useRef(new Date()).current;
  const todayStr = dateStr(today);

  const [view, setView] = useState<View>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date(today));
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [granjas, setGranjas] = useState<Granja[]>([]);
  const [tiposActividad, setTiposActividad] = useState<TipoActividad[]>([]);

  // Filters
  const [filterEmpleado, setFilterEmpleado] = useState("");
  const [filterGranja, setFilterGranja] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fFecha, setFFecha] = useState("");
  const [fHoraInicio, setFHoraInicio] = useState("");
  const [fHoraFin, setFHoraFin] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fGranja, setFGranja] = useState("");
  const [fDescripcion, setFDescripcion] = useState("");
  const [fComentarios, setFComentarios] = useState("");
  const [fEmpleados, setFEmpleados] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Distance (day view only)
  const [calcDist, setCalcDist] = useState(false);
  const [distResult, setDistResult] = useState<DistResult | null>(null);

  // ── Load reference data ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadRef() {
      type R<T> = Promise<{ data: T | null }>;
      const [{ data: emps }, { data: gs }, { data: tipos }] = await Promise.all([
        supabase.from("usuarios_perfil" as never)
          .select("id, nombre, apellidos, color, tipos_usuario!inner(es_trabajador)")
          .eq("activo", true)
          .eq("tipos_usuario.es_trabajador", true)
          .order("nombre") as unknown as R<(Empleado & { tipos_usuario: unknown })[]>,
        supabase.from("granjas" as never)
          .select("id, nombre").eq("activo", true).order("nombre") as unknown as R<Granja[]>,
        supabase.from("tipos_actividad" as never)
          .select("id, nombre").eq("activo", true).order("nombre") as unknown as R<TipoActividad[]>,
      ]);
      setEmpleados(emps ?? []);
      setGranjas(gs ?? []);
      setTiposActividad(tipos ?? []);
    }
    loadRef();
  }, [supabase]);

  // ── Load activities ──────────────────────────────────────────────────────
  const loadActivities = useCallback(async () => {
    setLoading(true);

    let from: string, to: string;
    if (view === "day") {
      from = to = dateStr(currentDate);
    } else if (view === "week") {
      const ws = weekStart(currentDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      from = dateStr(ws);
      to = dateStr(we);
    } else {
      const grid = monthGrid(currentDate.getFullYear(), currentDate.getMonth());
      from = dateStr(grid[0][0]);
      to = dateStr(grid[5][6]);
    }

    type RawAct = {
      id: string; fecha: string; hora_inicio: string | null; hora_fin: string | null;
      id_tipo: string | null; id_granja: string | null; descripcion: string | null;
      comentarios: string | null;
      tipos_actividad: { nombre: string } | null;
      granjas: { nombre: string; direccion: string | null; poblacion: string | null } | null;
      actividades_empleados: {
        usuarios_perfil: { id: string; nombre: string; apellidos: string | null; color: string | null } | null;
      }[];
    };

    const { data } = (await supabase
      .from("actividades" as never)
      .select(`
        id, fecha, hora_inicio, hora_fin, id_tipo, id_granja, descripcion, comentarios,
        tipos_actividad(nombre),
        granjas(nombre, direccion, poblacion),
        actividades_empleados(usuarios_perfil(id, nombre, apellidos, color))
      `)
      .gte("fecha", from).lte("fecha", to)
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true })) as unknown as { data: RawAct[] | null };

    const acts: Activity[] = (data ?? []).map((row: RawAct) => ({
      id: row.id,
      fecha: row.fecha,
      hora_inicio: row.hora_inicio,
      hora_fin: row.hora_fin,
      id_tipo: row.id_tipo,
      id_granja: row.id_granja,
      descripcion: row.descripcion,
      comentarios: row.comentarios,
      tipo: row.tipos_actividad,
      granja: row.granjas,
      empleados: (row.actividades_empleados ?? [])
        .map((ae: RawAct["actividades_empleados"][number]) => ae.usuarios_perfil)
        .filter((e): e is NonNullable<typeof e> => e !== null),
    }));
    setActivities(acts);
    setLoading(false);
  }, [supabase, view, currentDate]);

  useEffect(() => { loadActivities(); }, [loadActivities]);
  useEffect(() => { setDistResult(null); }, [currentDate, filterEmpleado]);

  // ── Filtered activities ───────────────────────────────────────────────────
  const filteredActivities = useMemo(() =>
    activities.filter((act) => {
      if (filterEmpleado && !act.empleados.find((e) => e.id === filterEmpleado)) return false;
      if (filterGranja && act.id_granja !== filterGranja) return false;
      return true;
    }),
    [activities, filterEmpleado, filterGranja]
  );

  // ── Navigation ───────────────────────────────────────────────────────────
  function navigate(dir: 1 | -1) {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function periodLabel(): string {
    if (view === "day") {
      return `${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === "week") {
      const ws = weekStart(currentDate);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()}–${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
      }
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${ws.getFullYear()}`;
    }
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }

  // ── Modal helpers ────────────────────────────────────────────────────────
  function openNew(fecha?: string, hora?: string) {
    setEditId(null);
    setFFecha(fecha ?? todayStr);
    setFHoraInicio(hora ?? "");
    setFHoraFin("");
    setFTipo(tiposActividad[0]?.id ?? "");
    setFGranja("");
    setFDescripcion("");
    setFComentarios("");
    setFEmpleados([]);
    setMsg(null);
    setDeleteConfirm(false);
    setModalOpen(true);
  }

  function openEdit(act: Activity) {
    setEditId(act.id);
    setFFecha(act.fecha);
    setFHoraInicio(act.hora_inicio?.slice(0, 5) ?? "");
    setFHoraFin(act.hora_fin?.slice(0, 5) ?? "");
    setFTipo(act.id_tipo ?? "");
    setFGranja(act.id_granja ?? "");
    setFDescripcion(act.descripcion ?? "");
    setFComentarios(act.comentarios ?? "");
    setFEmpleados(act.empleados.map((e) => e.id));
    setMsg(null);
    setDeleteConfirm(false);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditId(null); }

  function toggleEmpleado(id: string) {
    setFEmpleados((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  }

  // ── Save / Delete ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!fFecha) { setMsg({ ok: false, text: "La fecha es obligatoria." }); return; }
    setSaving(true); setMsg(null);

    type DbR<T> = { data: T | null; error: { message: string } | null };

    const payload = {
      fecha: fFecha,
      hora_inicio: fHoraInicio || null,
      hora_fin: fHoraFin || null,
      id_tipo: fTipo || null,
      id_granja: fGranja || null,
      descripcion: fDescripcion.trim() || null,
      comentarios: fComentarios.trim() || null,
    };

    let actividadId = editId;

    if (editId) {
      const { error } = (await supabase
        .from("actividades" as never).update(payload as never).eq("id", editId)) as unknown as DbR<null>;
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    } else {
      const { data, error } = (await supabase
        .from("actividades" as never).insert(payload as never).select("id").single()) as unknown as DbR<{ id: string }>;
      if (error || !data) { setMsg({ ok: false, text: error?.message ?? "Error" }); setSaving(false); return; }
      actividadId = data.id;
    }

    if (actividadId) {
      await (supabase.from("actividades_empleados" as never).delete().eq("id_actividad", actividadId));
    }
    if (fEmpleados.length > 0 && actividadId) {
      await (supabase.from("actividades_empleados" as never)
        .insert(fEmpleados.map((id_empleado) => ({ id_actividad: actividadId, id_empleado })) as never));
    }

    setMsg({ ok: true, text: "Guardado correctamente." });
    loadActivities();
    setSaving(false);
    setTimeout(closeModal, 800);
  }

  async function handleDelete() {
    if (!editId) return;
    setSaving(true);
    await (supabase.from("actividades" as never).delete().eq("id", editId));
    closeModal();
    loadActivities();
    setSaving(false);
  }

  // ── Distance calculation (day view) ──────────────────────────────────────
  async function calculateDayDistance() {
    if (!filterEmpleado) return;
    setCalcDist(true);
    setDistResult(null);

    const { data: empData } = (await supabase
      .from("usuarios_perfil" as never)
      .select("direccion, nombre")
      .eq("id", filterEmpleado)
      .single()) as unknown as { data: { direccion: string | null; nombre: string } | null };

    const empNombre = empData?.nombre ?? "Empleado";
    const empDireccion = empData?.direccion?.trim();

    const dayActs = filteredActivities
      .filter((a) => a.fecha === dateStr(currentDate))
      .sort((a, b) => (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? ""));

    const stops: { label: string; addr: string }[] = [];
    if (empDireccion) stops.push({ label: empNombre, addr: empDireccion });

    const seenAddrs = new Set<string>();
    for (const act of dayActs) {
      if (!act.granja) continue;
      const addr = [act.granja.direccion, act.granja.poblacion].filter(Boolean).join(", ");
      if (!addr || seenAddrs.has(addr)) continue;
      seenAddrs.add(addr);
      stops.push({ label: act.granja.nombre, addr });
    }

    if (stops.length < 2) {
      setDistResult({ total: 0, legs: [], error: "No hay suficientes direcciones para calcular la ruta. Añade la dirección del empleado y asegúrate de que las granjas tienen dirección." });
      setCalcDist(false);
      return;
    }

    const coords: ({ lat: number; lon: number } | null)[] = [];
    for (let i = 0; i < stops.length; i++) {
      if (i > 0) await sleep(1100);
      coords.push(await geocodeAddress(stops[i].addr));
    }

    const legs: DistLeg[] = [];
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = coords[i]; const b = coords[i + 1];
      if (a && b) {
        const km = haversineKm(a, b);
        legs.push({ from: stops[i].label, to: stops[i + 1].label, km });
        total += km;
      }
    }

    setDistResult({ total, legs });
    setCalcDist(false);
  }

  // ── Time grid helpers ────────────────────────────────────────────────────
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalGridH = (HOUR_END - HOUR_START) * HOUR_H;

  function activitiesForDate(d: Date): Activity[] {
    return filteredActivities.filter((a) => a.fecha === dateStr(d));
  }

  // ── Activity card (grid views) ────────────────────────────────────────────
  function renderCard(act: Activity, narrow = false) {
    const color = actColor(act);
    const rgb = hexToRgb(color);
    const top = act.hora_inicio ? timeToTop(act.hora_inicio.slice(0, 5)) : 0;
    const height = (act.hora_inicio && act.hora_fin)
      ? timeToDuration(act.hora_inicio.slice(0, 5), act.hora_fin.slice(0, 5))
      : 36;

    return (
      <div
        key={act.id}
        onClick={(e) => { e.stopPropagation(); openEdit(act); }}
        className="absolute left-0.5 right-0.5 rounded-md cursor-pointer overflow-hidden select-none z-10"
        style={{ top, height, backgroundColor: `rgba(${rgb},0.12)`, borderLeft: `4px solid ${color}` }}
      >
        <div className="px-1.5 py-1 h-full overflow-hidden">
          {act.hora_inicio && (
            <div className="text-xs font-medium leading-none mb-0.5" style={{ color }}>
              {act.hora_inicio.slice(0, 5)}{act.hora_fin ? `–${act.hora_fin.slice(0, 5)}` : ""}
            </div>
          )}
          {!narrow && (
            <div className="text-xs text-gray-700 truncate leading-tight">
              {act.descripcion ?? act.tipo?.nombre ?? "Sin tipo"}
            </div>
          )}
          {act.empleados.length > 0 && (
            <div className="flex gap-0.5 mt-0.5 flex-wrap">
              {act.empleados.slice(0, 3).map((e) => (
                <span key={e.id} className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: e.color ?? "#6B7280" }} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Week view ─────────────────────────────────────────────────────────────
  function WeekView() {
    const ws = weekStart(currentDate);
    const days = weekDays(ws);

    return (
      <div className="flex flex-col overflow-hidden rounded-xl" style={{ border: "1px solid #e5e5e5" }}>
        <div className="flex" style={{ borderBottom: "1px solid #e5e5e5" }}>
          <div className="w-12 flex-shrink-0" />
          {days.map((d, i) => {
            const isToday = dateStr(d) === todayStr;
            return (
              <div key={i} className="flex-1 text-center py-2 text-xs font-medium"
                style={{ color: isToday ? "var(--accent)" : "#888780", borderLeft: "1px solid #e5e5e5",
                  backgroundColor: isToday ? "rgba(var(--accent-rgb,59,130,246),0.04)" : undefined }}>
                <div>{DAY_NAMES_SHORT[i]}</div>
                <div className={`text-base font-semibold mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "text-white" : "text-gray-800"}`}
                  style={isToday ? { backgroundColor: "var(--accent)" } : undefined}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
          <div className="flex" style={{ position: "relative" }}>
            <div className="w-12 flex-shrink-0 relative" style={{ height: totalGridH }}>
              {hours.map((h) => (
                <div key={h} className="absolute right-1 text-xs"
                  style={{ top: (h - HOUR_START) * HOUR_H - 6, color: "#aaa", fontSize: 10 }}>
                  {p2(h)}:00
                </div>
              ))}
            </div>
            {days.map((d, i) => {
              const isToday = dateStr(d) === todayStr;
              return (
                <div key={i} className="flex-1 relative cursor-pointer"
                  style={{ height: totalGridH, borderLeft: "1px solid #e5e5e5",
                    backgroundColor: isToday ? "rgba(59,130,246,0.02)" : undefined }}
                  onClick={() => openNew(dateStr(d), `${p2(HOUR_START)}:00`)}>
                  {hours.map((h) => (
                    <div key={h} className="absolute left-0 right-0 pointer-events-none"
                      style={{ top: (h - HOUR_START) * HOUR_H, borderTop: "1px solid #f0f0f0" }} />
                  ))}
                  {activitiesForDate(d).map((act) => renderCard(act, true))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Day view ──────────────────────────────────────────────────────────────
  function DayView() {
    const dayActs = activitiesForDate(currentDate);
    const isToday = dateStr(currentDate) === todayStr;

    return (
      <div>
        {/* Distance panel — only when an employee filter is active */}
        {filterEmpleado && (
          <div className="mb-4 p-4 rounded-xl" style={{ border: "1px solid #e5e5e5" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-gray-800">Distancia recorrida del día</div>
                <div className="text-xs mt-0.5" style={{ color: "#888780" }}>
                  Desde el domicilio del empleado hasta cada granja visitada, en orden cronológico
                </div>
              </div>
              <button
                onClick={calculateDayDistance}
                disabled={calcDist}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {calcDist ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Calculando…
                  </>
                ) : "Calcular ruta"}
              </button>
            </div>

            {distResult && (
              <div className="mt-3">
                {distResult.error ? (
                  <p className="text-sm" style={{ color: "#A32D2D" }}>{distResult.error}</p>
                ) : (
                  <>
                    <div className="space-y-1.5 mb-2">
                      {distResult.legs.map((leg, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-gray-300 flex-shrink-0">→</span>
                          <span className="truncate min-w-0">{leg.from}</span>
                          <span className="text-gray-300 flex-shrink-0">→</span>
                          <span className="truncate min-w-0">{leg.to}</span>
                          <span className="ml-auto flex-shrink-0 font-medium text-gray-800 tabular-nums">
                            {leg.km.toFixed(1)} km
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Total estimado</span>
                      <span className="text-base font-semibold" style={{ color: "var(--accent)" }}>
                        {distResult.total.toFixed(1)} km
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "#888780" }}>
                      * Distancia en línea recta (haversine). Puede diferir de la ruta real.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
          <div className="py-3 text-center text-sm font-medium"
            style={{ borderBottom: "1px solid #e5e5e5", color: isToday ? "var(--accent)" : "#444" }}>
            {DAY_NAMES_SHORT[(currentDate.getDay() + 6) % 7]} {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
            <div className="flex" style={{ position: "relative" }}>
              <div className="w-12 flex-shrink-0 relative" style={{ height: totalGridH }}>
                {hours.map((h) => (
                  <div key={h} className="absolute right-1 text-xs"
                    style={{ top: (h - HOUR_START) * HOUR_H - 6, color: "#aaa", fontSize: 10 }}>
                    {p2(h)}:00
                  </div>
                ))}
              </div>
              <div className="flex-1 relative cursor-pointer"
                style={{ height: totalGridH, borderLeft: "1px solid #e5e5e5" }}
                onClick={() => openNew(dateStr(currentDate), `${p2(HOUR_START)}:00`)}>
                {hours.map((h) => (
                  <div key={h} className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: (h - HOUR_START) * HOUR_H, borderTop: "1px solid #f0f0f0" }} />
                ))}
                {dayActs.map((act) => renderCard(act, false))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Month view ────────────────────────────────────────────────────────────
  function MonthView() {
    const grid = monthGrid(currentDate.getFullYear(), currentDate.getMonth());
    const thisMonth = currentDate.getMonth();

    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
        <div className="grid grid-cols-7" style={{ borderBottom: "1px solid #e5e5e5" }}>
          {DAY_NAMES_SHORT.map((name) => (
            <div key={name} className="py-2 text-center text-xs font-medium uppercase tracking-wide"
              style={{ color: "#888780" }}>{name}</div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7"
            style={{ borderBottom: wi < 5 ? "1px solid #e5e5e5" : undefined }}>
            {week.map((d, di) => {
              const ds = dateStr(d);
              const isToday = ds === todayStr;
              const isThisMonth = d.getMonth() === thisMonth;
              const dayActs = filteredActivities.filter((a) => a.fecha === ds);
              const visible = dayActs.slice(0, 3);
              const overflow = dayActs.length - visible.length;

              return (
                <div key={di} className="min-h-[80px] p-1 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderLeft: di > 0 ? "1px solid #e5e5e5" : undefined }}
                  onClick={() => { setCurrentDate(new Date(d)); setView("day"); }}>
                  <div className="flex justify-end mb-1">
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "text-white" : isThisMonth ? "text-gray-800" : "text-gray-300"}`}
                      style={isToday ? { backgroundColor: "var(--accent)" } : undefined}>
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((act) => {
                      const color = actColor(act);
                      return (
                        <div key={act.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(act); }}
                          className="text-xs px-1 py-0.5 rounded truncate"
                          style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}>
                          {act.descripcion ?? act.tipo?.nombre ?? act.hora_inicio?.slice(0, 5) ?? "Actividad"}
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div className="text-xs px-1 py-0.5" style={{ color: "#888780" }}>
                        +{overflow} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  function ListView() {
    if (filteredActivities.length === 0) {
      return (
        <div className="text-center py-16" style={{ color: "#888780", fontSize: 13 }}>
          No hay actividades para este período
        </div>
      );
    }

    const byDate = new Map<string, Activity[]>();
    for (const act of filteredActivities) {
      const arr = byDate.get(act.fecha) ?? [];
      arr.push(act);
      byDate.set(act.fecha, arr);
    }
    const sortedDates = Array.from(byDate.keys()).sort();

    return (
      <div className="space-y-5">
        {sortedDates.map((ds) => {
          const d = new Date(ds + "T12:00:00");
          const isToday = ds === todayStr;
          const acts = byDate.get(ds) ?? [];

          return (
            <div key={ds}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={isToday
                    ? { backgroundColor: "var(--accent)", color: "white" }
                    : { backgroundColor: "#f0f0f0", color: "#555" }}>
                  {DAY_NAMES_SHORT[(d.getDay() + 6) % 7]} {d.getDate()} {MONTH_NAMES[d.getMonth()]}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#f0f0f0" }} />
              </div>
              <div className="space-y-2">
                {acts.map((act) => {
                  const color = actColor(act);
                  return (
                    <div key={act.id} onClick={() => openEdit(act)}
                      className="rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ border: "1px solid #e5e5e5", borderLeft: `4px solid ${color}` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {(act.hora_inicio || act.hora_fin) && (
                              <span className="text-xs font-medium flex-shrink-0" style={{ color }}>
                                {act.hora_inicio?.slice(0, 5) ?? ""}
                                {act.hora_fin ? `–${act.hora_fin.slice(0, 5)}` : ""}
                              </span>
                            )}
                            {act.tipo && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: `${color}20`, color }}>
                                {act.tipo.nombre}
                              </span>
                            )}
                          </div>
                          {act.descripcion && (
                            <div className="text-sm font-medium text-gray-800 mt-0.5 truncate">
                              {act.descripcion}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {act.granja && (
                              <span className="text-xs text-gray-500">{act.granja.nombre}</span>
                            )}
                            {act.comentarios && (
                              <span className="text-xs text-gray-400 truncate">{act.comentarios}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {act.empleados.map((e) => (
                            <span key={e.id}
                              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                              style={{ backgroundColor: e.color ?? "#6B7280" }}
                              title={`${e.nombre} ${e.apellidos ?? ""}`}>
                              {e.nombre[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Mobile list ───────────────────────────────────────────────────────────
  function MobileList() {
    const dayActs = activitiesForDate(currentDate);
    return (
      <div>
        <div className="mb-3 text-sm font-medium text-gray-700">
          {DAY_NAMES_SHORT[(currentDate.getDay() + 6) % 7]} {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]}
        </div>
        {dayActs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "#888780" }}>
            No hay actividades para este día
          </div>
        ) : (
          <div className="space-y-2">
            {dayActs.map((act) => {
              const color = actColor(act);
              return (
                <div key={act.id} onClick={() => openEdit(act)} className="rounded-xl p-3 cursor-pointer"
                  style={{ border: "1px solid #e5e5e5", borderLeft: `4px solid ${color}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {act.descripcion ?? act.tipo?.nombre ?? "Sin tipo"}
                      </div>
                      {act.descripcion && act.tipo && (
                        <div className="text-xs mt-0.5" style={{ color }}>{act.tipo.nombre}</div>
                      )}
                      {(act.hora_inicio || act.granja) && (
                        <div className="text-xs mt-0.5" style={{ color: "#888780" }}>
                          {act.hora_inicio?.slice(0, 5)}{act.hora_fin ? `–${act.hora_fin.slice(0, 5)}` : ""}
                          {act.granja ? ` · ${act.granja.nombre}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {act.empleados.map((e) => (
                        <span key={e.id} className="w-5 h-5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: e.color ?? "#6B7280" }}
                          title={`${e.nombre} ${e.apellidos ?? ""}`} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-gray-900" style={{ fontWeight: 500, fontSize: 22 }}>Actividades</h1>
          <p style={{ color: "#888780", fontSize: 13 }}>Calendario de visitas, reuniones y actividades</p>
        </div>
        <button onClick={() => openNew()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white self-start sm:self-auto"
          style={{ backgroundColor: "var(--accent)" }}>
          <PlusIcon className="h-4 w-4" />
          Nueva actividad
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* View switcher */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
          {(["day", "week", "month", "list"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: view === v ? "var(--accent)" : "white", color: view === v ? "white" : "#555" }}>
              {v === "day" ? "Día" : v === "week" ? "Semana" : v === "month" ? "Mes" : "Lista"}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-xl transition-colors">
            ‹
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center capitalize">
            {periodLabel()}
          </span>
          <button onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-xl transition-colors">
            ›
          </button>
        </div>

        <button onClick={() => setCurrentDate(new Date(today))}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
          Hoy
        </button>

        {/* Filters */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {empleados.length > 0 && (
            <select value={filterEmpleado} onChange={(e) => setFilterEmpleado(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent">
              <option value="">Todos los empleados</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre} {e.apellidos ?? ""}</option>
              ))}
            </select>
          )}
          {granjas.length > 0 && (
            <select value={filterGranja} onChange={(e) => setFilterGranja(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent">
              <option value="">Todas las granjas</option>
              {granjas.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Views */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "#888780", fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            {view === "week" && <WeekView />}
            {view === "day" && <DayView />}
            {view === "month" && <MonthView />}
            {view === "list" && <ListView />}
          </div>

          {/* Mobile */}
          <div className="lg:hidden">
            {(view === "month" || view === "list") ? (
              view === "month" ? <MonthView /> : <ListView />
            ) : (
              <>
                <div className="flex items-center gap-1 mb-3">
                  <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-xl">‹</button>
                  <span className="text-sm text-gray-700 flex-1 text-center">{periodLabel()}</span>
                  <button onClick={() => navigate(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-xl">›</button>
                </div>
                {view === "day" && filterEmpleado && (
                  <div className="mb-3 p-3 rounded-xl" style={{ border: "1px solid #e5e5e5" }}>
                    <button onClick={calculateDayDistance} disabled={calcDist}
                      className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: "var(--accent)" }}>
                      {calcDist ? "Calculando…" : "Calcular distancia del día"}
                    </button>
                    {distResult && !distResult.error && (
                      <div className="mt-2 text-center">
                        <span className="text-base font-semibold" style={{ color: "var(--accent)" }}>
                          {distResult.total.toFixed(1)} km
                        </span>
                        <span className="text-xs ml-1" style={{ color: "#888780" }}>estimados</span>
                      </div>
                    )}
                    {distResult?.error && (
                      <p className="mt-2 text-xs text-center" style={{ color: "#A32D2D" }}>{distResult.error}</p>
                    )}
                  </div>
                )}
                <MobileList />
              </>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            style={{ border: "1px solid #e5e5e5" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontWeight: 500, fontSize: 15 }} className="text-gray-800">
                {editId ? "Editar actividad" : "Nueva actividad"}
              </h2>
              {editId && !deleteConfirm && (
                <button onClick={() => setDeleteConfirm(true)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {deleteConfirm && (
              <div className="mb-4 p-3 rounded-xl flex items-center justify-between gap-3"
                style={{ border: "1px solid #FECACA", backgroundColor: "#FEF2F2" }}>
                <span className="text-sm text-red-700">¿Eliminar esta actividad?</span>
                <div className="flex gap-2">
                  <button onClick={handleDelete} disabled={saving} className="text-xs font-medium text-red-600 hover:underline">Eliminar</button>
                  <button onClick={() => setDeleteConfirm(false)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Fecha *</label>
                <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Hora inicio</label>
                  <input type="time" value={fHoraInicio} onChange={(e) => setFHoraInicio(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Hora fin</label>
                  <input type="time" value={fHoraFin} onChange={(e) => setFHoraFin(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Tipo de actividad</label>
                <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">— Sin tipo —</option>
                  {tiposActividad.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Descripción corta</label>
                <input type="text" value={fDescripcion} onChange={(e) => setFDescripcion(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Texto breve que aparece en el calendario" />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Empleados</label>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
                  {empleados.length === 0 ? (
                    <p className="px-3 py-2 text-xs" style={{ color: "#888780" }}>No hay empleados disponibles</p>
                  ) : empleados.map((emp, i) => {
                    const selected = fEmpleados.includes(emp.id);
                    return (
                      <label key={emp.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : undefined }}>
                        <div className="relative flex-shrink-0">
                          <input type="checkbox" checked={selected} onChange={() => toggleEmpleado(emp.id)} className="sr-only" />
                          <div className="w-4 h-4 rounded flex items-center justify-center"
                            style={{ backgroundColor: selected ? (emp.color ?? "var(--accent)") : "white",
                              border: `2px solid ${selected ? (emp.color ?? "var(--accent)") : "#d1d5db"}` }}>
                            {selected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                                <polyline points="2 6 5 9 10 3" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color ?? "#6B7280" }} />
                        <span className="text-sm text-gray-700">{emp.nombre} {emp.apellidos ?? ""}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Granja (opcional)</label>
                <select value={fGranja} onChange={(e) => setFGranja(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent">
                  <option value="">— Sin granja —</option>
                  {granjas.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Comentarios</label>
                <textarea value={fComentarios} onChange={(e) => setFComentarios(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                  placeholder="Notas adicionales…" />
              </div>
            </div>

            {msg && (
              <div className="mt-4 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}>
                {msg.text}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={closeModal}
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
