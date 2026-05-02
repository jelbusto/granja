"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";

// ── Types ────────────────────────────────────────────────────────────────────
type Trabajador = { id: string; nombre: string; apellidos: string | null };

type Fichaje = {
  id: string;
  id_empleado: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_trabajados: number;
  es_manual: boolean;
  latitud_entrada: number | null;
  longitud_entrada: number | null;
  notas: string | null;
};

type Aprobacion = {
  id: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  total_minutos: number;
  id_aprobador: string | null;
  fecha_aprobacion: string | null;
  comentario: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function p2(n: number) { return n.toString().padStart(2, "0"); }

function lastDayOf(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtElapsed(entradaISO: string, now: Date) {
  const ms = Math.max(0, now.getTime() - new Date(entradaISO).getTime());
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}h ${p2(Math.floor((s % 3600) / 60))}m ${p2(s % 60)}s`;
}

function monthName(mes: number) {
  return new Date(2000, mes - 1, 1).toLocaleString("es", { month: "long" });
}

async function getGPS(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 0 }
    );
  });
}

const INPUT_CLS = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FichajesPage() {
  const supabase = useRef(createClient()).current;
  const today = useRef(new Date()).current;
  const todayStr = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [viewAnio, setViewAnio] = useState(today.getFullYear());
  const [viewMes, setViewMes] = useState(today.getMonth() + 1);

  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [aprobacion, setAprobacion] = useState<Aprobacion | null>(null);
  const [activeSession, setActiveSession] = useState<Fichaje | null>(null);

  const [now, setNow] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Day expand + manual form
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mHoras, setMHoras] = useState("0");
  const [mMinutos, setMMinutos] = useState("0");
  const [mNotas, setMNotas] = useState("");

  // Approval
  const [showRechazar, setShowRechazar] = useState(false);
  const [rechazarComentario, setRechazarComentario] = useState("");

  // Timer
  useEffect(() => {
    if (activeSession?.hora_entrada) {
      timerRef.current = setInterval(() => setNow(new Date()), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  // Init: auth + profile + trabajadores list
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      type P = { id_tipo_usuario: string | null; tipos_usuario: { nombre: string; es_trabajador: boolean } | null };
      const { data: perfil } = await (supabase
        .from("usuarios_perfil" as never)
        .select("id_tipo_usuario, tipos_usuario(nombre, es_trabajador)")
        .eq("id", user.id)
        .single()) as { data: P | null; error: unknown };

      const admin = perfil?.tipos_usuario?.nombre === "Admin";
      setIsAdmin(admin);

      if (admin) {
        type W = { id: string; nombre: string; apellidos: string | null; tipos_usuario: { es_trabajador: boolean } };
        const { data: ws } = await (supabase
          .from("usuarios_perfil" as never)
          .select("id, nombre, apellidos, tipos_usuario!inner(es_trabajador)")
          .eq("activo", true)
          .order("nombre")) as { data: W[] | null; error: unknown };
        const list = (ws ?? []).filter((w) => w.tipos_usuario.es_trabajador);
        setTrabajadores(list);
        setSelectedId(list[0]?.id ?? user.id);
      } else {
        setSelectedId(user.id);
      }
    }
    init();
  }, [supabase]);

  // Load fichajes + aprobacion + active session
  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);

    const firstDay = `${viewAnio}-${p2(viewMes)}-01`;
    const lastDay = `${viewAnio}-${p2(viewMes)}-${p2(lastDayOf(viewAnio, viewMes))}`;

    // Current month range for active session check
    const n = new Date();
    const cy = n.getFullYear(); const cm = n.getMonth() + 1;
    const cFirst = `${cy}-${p2(cm)}-01`;
    const cLast = `${cy}-${p2(cm)}-${p2(lastDayOf(cy, cm))}`;

    type F = Fichaje; type A = Aprobacion;

    const [{ data: fs }, { data: apr }, { data: act }] = await Promise.all([
      (supabase.from("fichajes" as never)
        .select("*")
        .eq("id_empleado", selectedId)
        .gte("fecha", firstDay)
        .lte("fecha", lastDay)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: true })) as unknown as Promise<{ data: F[] | null }>,
      (supabase.from("aprobaciones_fichajes" as never)
        .select("*")
        .eq("id_empleado", selectedId)
        .eq("anio", viewAnio)
        .eq("mes", viewMes)
        .maybeSingle()) as unknown as Promise<{ data: A | null }>,
      (supabase.from("fichajes" as never)
        .select("*")
        .eq("id_empleado", selectedId)
        .gte("fecha", cFirst)
        .lte("fecha", cLast)
        .is("hora_salida", null)
        .not("hora_entrada", "is", null)
        .order("hora_entrada", { ascending: false })
        .limit(1)
        .maybeSingle()) as unknown as Promise<{ data: F | null }>,
    ]);

    setFichajes(fs ?? []);
    setAprobacion(apr ?? null);
    setActiveSession(act ?? null);
    setLoading(false);
  }, [supabase, selectedId, viewAnio, viewMes]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Month nav ──────────────────────────────────────────────────────────────
  const isCurrentMonth = viewAnio === today.getFullYear() && viewMes === today.getMonth() + 1;

  function prevMonth() {
    if (viewMes === 1) { setViewAnio(viewAnio - 1); setViewMes(12); }
    else { setViewMes(viewMes - 1); }
    setExpandedDay(null); setShowManualForm(false);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (viewMes === 12) { setViewAnio(viewAnio + 1); setViewMes(1); }
    else { setViewMes(viewMes + 1); }
    setExpandedDay(null); setShowManualForm(false);
  }

  // ── Clock in/out ───────────────────────────────────────────────────────────
  async function handleClockIn() {
    setSaving(true); setMsg(null);
    const pos = await getGPS();
    const { data, error } = await (supabase
      .from("fichajes" as never)
      .insert({
        id_empleado: selectedId,
        fecha: todayStr,
        hora_entrada: new Date().toISOString(),
        es_manual: false,
        minutos_trabajados: 0,
        latitud_entrada: pos?.lat ?? null,
        longitud_entrada: pos?.lng ?? null,
      } as never)
      .select("*")
      .single()) as unknown as { data: Fichaje | null; error: { message: string } | null };
    if (error) { setMsg({ ok: false, text: error.message }); }
    else { setActiveSession(data); loadData(); }
    setSaving(false);
  }

  async function handleClockOut() {
    if (!activeSession) return;
    setSaving(true); setMsg(null);
    const pos = await getGPS();
    const outTime = new Date();
    const minutos = Math.max(0, Math.floor((outTime.getTime() - new Date(activeSession.hora_entrada!).getTime()) / 60000));
    const { error } = await (supabase
      .from("fichajes" as never)
      .update({
        hora_salida: outTime.toISOString(),
        minutos_trabajados: minutos,
        latitud_salida: pos?.lat ?? null,
        longitud_salida: pos?.lng ?? null,
      } as never)
      .eq("id", activeSession.id)) as unknown as { error: { message: string } | null };
    if (error) { setMsg({ ok: false, text: error.message }); }
    else { setActiveSession(null); loadData(); }
    setSaving(false);
  }

  // ── Manual entry ───────────────────────────────────────────────────────────
  function openAdd(day: number) {
    setExpandedDay(day);
    setEditingId(null); setMHoras("0"); setMMinutos("0"); setMNotas("");
    setShowManualForm(true);
  }

  function openEdit(f: Fichaje, day: number) {
    setExpandedDay(day);
    setEditingId(f.id);
    setMHoras(String(Math.floor(f.minutos_trabajados / 60)));
    setMMinutos(String(f.minutos_trabajados % 60));
    setMNotas(f.notas ?? "");
    setShowManualForm(true);
  }

  function closeForm() {
    setShowManualForm(false); setEditingId(null);
  }

  async function saveManual(day: number) {
    const h = Math.max(0, parseInt(mHoras) || 0);
    const m = Math.max(0, parseInt(mMinutos) || 0);
    const total = h * 60 + m;
    if (total <= 0) { setMsg({ ok: false, text: "El tiempo debe ser mayor que 0." }); return; }
    setSaving(true); setMsg(null);

    const dateStr = `${viewAnio}-${p2(viewMes)}-${p2(day)}`;

    if (editingId) {
      const { error } = await (supabase
        .from("fichajes" as never)
        .update({ minutos_trabajados: total, notas: mNotas || null } as never)
        .eq("id", editingId)) as unknown as { error: { message: string } | null };
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    } else {
      const { error } = await (supabase
        .from("fichajes" as never)
        .insert({
          id_empleado: selectedId,
          fecha: dateStr,
          es_manual: true,
          minutos_trabajados: total,
          notas: mNotas || null,
        } as never)) as unknown as { error: { message: string } | null };
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    }

    closeForm();
    loadData();
    setSaving(false);
  }

  async function deleteFichaje(id: string) {
    await (supabase.from("fichajes" as never).delete().eq("id", id));
    loadData();
  }

  // ── Approval ──────────────────────────────────────────────────────────────
  const totalMin = fichajes.reduce((s, f) => s + f.minutos_trabajados, 0);

  async function handleAprobar() {
    setSaving(true);
    await (supabase.from("aprobaciones_fichajes" as never).upsert({
      id_empleado: selectedId,
      anio: viewAnio, mes: viewMes,
      total_minutos: totalMin,
      estado: "aprobado",
      id_aprobador: currentUserId,
      fecha_aprobacion: new Date().toISOString(),
      comentario: null,
    } as never, { onConflict: "id_empleado,anio,mes" }));
    loadData();
    setSaving(false);
  }

  async function handleRechazar() {
    setSaving(true);
    await (supabase.from("aprobaciones_fichajes" as never).upsert({
      id_empleado: selectedId,
      anio: viewAnio, mes: viewMes,
      total_minutos: totalMin,
      estado: "rechazado",
      id_aprobador: currentUserId,
      fecha_aprobacion: new Date().toISOString(),
      comentario: rechazarComentario || null,
    } as never, { onConflict: "id_empleado,anio,mes" }));
    setShowRechazar(false); setRechazarComentario("");
    loadData();
    setSaving(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isOwnData = selectedId === currentUserId;
  const approved = aprobacion?.estado === "aprobado";
  const canEdit = isAdmin || (isOwnData && !approved);
  const maxDay = isCurrentMonth ? today.getDate() : lastDayOf(viewAnio, viewMes);
  const days = Array.from({ length: maxDay }, (_, i) => maxDay - i);

  function dayFichajes(day: number) {
    const d = `${viewAnio}-${p2(viewMes)}-${p2(day)}`;
    return fichajes.filter((f) => f.fecha === d);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-3xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Fichajes</h1>
      <p className="mb-6" style={{ color: "#888780", fontSize: 13 }}>Registro de horas trabajadas</p>

      {/* Employee selector (admin only) */}
      {isAdmin && trabajadores.length > 0 && (
        <div className="mb-6">
          <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Empleado</label>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setExpandedDay(null); setShowManualForm(false); }}
            className={`${INPUT_CLS} w-full sm:w-72`}
          >
            {trabajadores.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre} {t.apellidos ?? ""}</option>
            ))}
          </select>
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-lg transition-colors">
          ‹
        </button>
        <span className="text-base font-medium text-gray-800 capitalize w-40 text-center">
          {monthName(viewMes)} {viewAnio}
        </span>
        <button onClick={nextMonth} disabled={isCurrentMonth}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          ›
        </button>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="mb-4 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
          <div>
            <div className="text-sm font-medium text-green-800">Fichaje activo</div>
            {isOwnData ? (
              <div className="text-2xl font-mono font-semibold text-green-700 mt-1">
                {fmtElapsed(activeSession.hora_entrada!, now)}
              </div>
            ) : (
              <div className="text-sm text-green-700 mt-1">
                Desde {new Date(activeSession.hora_entrada!).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            {activeSession.latitud_entrada != null && (
              <div className="text-xs text-green-600 mt-0.5">
                GPS: {Number(activeSession.latitud_entrada).toFixed(4)}, {Number(activeSession.longitud_entrada).toFixed(4)}
              </div>
            )}
          </div>
          {isOwnData && (
            <button onClick={handleClockOut} disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 self-start sm:self-auto"
              style={{ backgroundColor: "#DC2626" }}>
              {saving ? "Guardando…" : "Fichar salida"}
            </button>
          )}
        </div>
      )}

      {/* Clock in button */}
      {!activeSession && isOwnData && isCurrentMonth && canEdit && !loading && (
        <div className="mb-4">
          <button onClick={handleClockIn} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}>
            {saving ? "Registrando…" : "Fichar entrada"}
          </button>
        </div>
      )}

      {/* Message */}
      {msg && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}>
          {msg.text}
        </div>
      )}

      {/* Monthly total */}
      {!loading && (
        <div className="mb-4 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: "#f8f7f4", border: "1px solid #e5e5e5" }}>
          <span className="text-sm text-gray-600">Total del mes</span>
          <span className="text-base font-semibold text-gray-800">{fmtMin(totalMin)}</span>
        </div>
      )}

      {/* Day list */}
      {loading ? (
        <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
      ) : days.length === 0 ? (
        <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">No hay días registrables en este mes</p>
      ) : (
        <div className="space-y-2 mb-8">
          {days.map((day) => {
            const df = dayFichajes(day);
            const dayMin = df.reduce((s, f) => s + f.minutos_trabajados, 0);
            const dateStr = `${viewAnio}-${p2(viewMes)}-${p2(day)}`;
            const isToday = dateStr === todayStr;
            const isExpanded = expandedDay === day;
            const hasActive = activeSession?.fecha === dateStr;
            const dayLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });

            return (
              <div key={day} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
                <button
                  onClick={() => {
                    const opening = expandedDay !== day;
                    setExpandedDay(opening ? day : null);
                    if (!opening) { setShowManualForm(false); setEditingId(null); }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium capitalize ${isToday ? "" : "text-gray-800"}`}
                      style={isToday ? { color: "var(--accent)" } : undefined}>
                      {dayLabel}
                    </span>
                    {isToday && (
                      <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: "var(--accent)", fontSize: 11 }}>
                        Hoy
                      </span>
                    )}
                    {hasActive && (
                      <span className="text-xs text-green-600 font-medium">● activo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {dayMin > 0 && (
                      <span className="text-sm font-medium text-gray-700">{fmtMin(dayMin)}</span>
                    )}
                    {df.length > 0 && (
                      <span className="text-xs text-gray-400 hidden sm:inline">{df.length} entrada{df.length !== 1 ? "s" : ""}</span>
                    )}
                    <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {df.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {df.map((f) => (
                          <div key={f.id} className="flex items-center justify-between rounded-lg px-3 py-2 gap-2"
                            style={{ backgroundColor: "#f8f7f4" }}>
                            <div className="text-sm text-gray-700 min-w-0">
                              {f.es_manual ? (
                                <span>{fmtMin(f.minutos_trabajados)}{f.notas ? ` — ${f.notas}` : ""}</span>
                              ) : (
                                <span>
                                  {f.hora_entrada
                                    ? new Date(f.hora_entrada).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                                    : "–"}
                                  {" → "}
                                  {f.hora_salida
                                    ? new Date(f.hora_salida).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                                    : <span className="text-green-600 font-medium">activo</span>}
                                  {f.minutos_trabajados > 0 && ` (${fmtMin(f.minutos_trabajados)})`}
                                  {f.notas && ` — ${f.notas}`}
                                </span>
                              )}
                            </div>
                            {canEdit && f.es_manual && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => openEdit(f, day)}
                                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                                  Editar
                                </button>
                                <button onClick={() => deleteFichaje(f.id)}
                                  className="text-gray-300 hover:text-red-500 transition-colors">
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Manual entry form */}
                    {canEdit && showManualForm && expandedDay === day && (
                      <div className="mt-3 p-3 rounded-lg" style={{ border: "1px solid #e5e5e5" }}>
                        <div className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: "#888780" }}>
                          {editingId ? "Editar entrada" : "Nueva entrada manual"}
                        </div>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Horas</label>
                            <input type="number" min="0" max="23" value={mHoras}
                              onChange={(e) => setMHoras(e.target.value)}
                              className={`${INPUT_CLS} w-20`} />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Minutos</label>
                            <input type="number" min="0" max="59" value={mMinutos}
                              onChange={(e) => setMMinutos(e.target.value)}
                              className={`${INPUT_CLS} w-20`} />
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs text-gray-500 mb-1">Notas</label>
                            <input type="text" value={mNotas}
                              onChange={(e) => setMNotas(e.target.value)}
                              placeholder="Opcional"
                              className={`${INPUT_CLS} w-full`} />
                          </div>
                          <button onClick={() => saveManual(day)} disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: "var(--accent)" }}>
                            {saving ? "…" : "Guardar"}
                          </button>
                          <button onClick={closeForm}
                            className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add button */}
                    {canEdit && !(showManualForm && expandedDay === day) && (
                      <button onClick={() => openAdd(day)}
                        className="mt-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                        <PlusIcon className="h-4 w-4" /> Añadir entrada manual
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approval section — admin viewing another employee */}
      {!loading && isAdmin && !isOwnData && (
        <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid #e5e5e5" }}>
          <div className="text-sm font-medium text-gray-800 mb-3">Aprobación mensual</div>

          {aprobacion ? (
            <div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium mb-3`}
                style={{
                  backgroundColor: aprobacion.estado === "aprobado" ? "#F0FDF4" : aprobacion.estado === "rechazado" ? "#FEF2F2" : "#FEFCE8",
                  color: aprobacion.estado === "aprobado" ? "#166534" : aprobacion.estado === "rechazado" ? "#991B1B" : "#854D0E",
                }}>
                {aprobacion.estado === "aprobado" ? "✓ Aprobado" : aprobacion.estado === "rechazado" ? "✗ Rechazado" : "⏳ Pendiente"}
                {" — "}{fmtMin(aprobacion.total_minutos)}
              </div>
              {aprobacion.comentario && (
                <p className="text-sm text-gray-500 mb-3 italic">&ldquo;{aprobacion.comentario}&rdquo;</p>
              )}
              <div className="flex gap-2 flex-wrap">
                {aprobacion.estado !== "aprobado" && (
                  <button onClick={handleAprobar} disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: "#16A34A" }}>
                    {saving ? "…" : `Aprobar ${fmtMin(totalMin)}`}
                  </button>
                )}
                {aprobacion.estado !== "rechazado" && (
                  <button onClick={() => setShowRechazar(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50">
                    Rechazar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Sin registro de aprobación. Total acumulado: <strong>{fmtMin(totalMin)}</strong>
              </p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleAprobar} disabled={saving || totalMin === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#16A34A" }}>
                  {saving ? "…" : `Aprobar ${fmtMin(totalMin)}`}
                </button>
                <button onClick={() => setShowRechazar(true)} disabled={totalMin === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {showRechazar && (
            <div className="mt-3 p-3 rounded-lg" style={{ border: "1px solid #FECACA" }}>
              <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
              <input type="text" value={rechazarComentario}
                onChange={(e) => setRechazarComentario(e.target.value)}
                placeholder="Explica el motivo…"
                className={`${INPUT_CLS} w-full mb-2`} />
              <div className="flex gap-2">
                <button onClick={handleRechazar} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#DC2626" }}>
                  {saving ? "…" : "Confirmar rechazo"}
                </button>
                <button onClick={() => { setShowRechazar(false); setRechazarComentario(""); }}
                  className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approval status for non-admin (own data) */}
      {!loading && !isAdmin && aprobacion && (
        <div className="mt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: aprobacion.estado === "aprobado" ? "#F0FDF4" : aprobacion.estado === "rechazado" ? "#FEF2F2" : "#FEFCE8",
              color: aprobacion.estado === "aprobado" ? "#166534" : aprobacion.estado === "rechazado" ? "#991B1B" : "#854D0E",
            }}>
            {aprobacion.estado === "aprobado" ? "✓ Mes aprobado" : aprobacion.estado === "rechazado" ? "✗ Mes rechazado" : "⏳ Pendiente de aprobación"}
          </div>
          {aprobacion.comentario && (
            <p className="mt-2 text-sm text-gray-500 italic">&ldquo;{aprobacion.comentario}&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
}
