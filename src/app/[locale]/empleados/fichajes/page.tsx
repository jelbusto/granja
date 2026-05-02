"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────
type Trabajador = { id: string; nombre: string; apellidos: string | null };

type FichajeRow = {
  key: string;        // local unique key (DB id if saved, random if new)
  id: string | null;  // null = not yet in DB
  fecha: string;
  entrada: string;    // "HH:MM" or ""
  salida: string;     // "HH:MM" or ""
  minutos: number;
};

type Aprobacion = {
  estado: "pendiente" | "aprobado" | "rechazado";
  total_minutos: number;
  comentario: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function p2(n: number) { return n.toString().padStart(2, "0"); }
function lastDayOf(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function fmtMin(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}
function monthName(mes: number) { return new Date(2000, mes - 1, 1).toLocaleString("es", { month: "long" }); }
function extractTime(iso: string): string { const m = iso.match(/T(\d{2}:\d{2})/); return m ? m[1] : ""; }
function computeMin(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0;
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = salida.split(":").map(Number);
  const d = (sh * 60 + sm) - (eh * 60 + em);
  return d > 0 ? d : 0;
}
function timeToISO(dateStr: string, t: string) { return `${dateStr}T${t}:00`; }
function uid() { return Math.random().toString(36).slice(2, 10); }

const TIME_CLS =
  "text-sm border border-gray-200 rounded-md px-1.5 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-50 disabled:text-gray-300 w-[84px]";
const SELECT_CLS =
  "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

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

  const [rows, setRows] = useState<FichajeRow[]>([]);
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [aprobacion, setAprobacion] = useState<Aprobacion | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showRechazar, setShowRechazar] = useState(false);
  const [rechazarComentario, setRechazarComentario] = useState("");

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      type P = { tipos_usuario: { nombre: string } | null };
      const { data: perfil } = await (supabase
        .from("usuarios_perfil" as never)
        .select("tipos_usuario(nombre)")
        .eq("id", user.id).single()) as { data: P | null; error: unknown };
      const admin = perfil?.tipos_usuario?.nombre === "Admin";
      setIsAdmin(admin);
      if (admin) {
        type W = { id: string; nombre: string; apellidos: string | null; tipos_usuario: { es_trabajador: boolean } };
        const { data: ws } = await (supabase
          .from("usuarios_perfil" as never)
          .select("id, nombre, apellidos, tipos_usuario!inner(es_trabajador)")
          .eq("activo", true).order("nombre")) as { data: W[] | null; error: unknown };
        const list = (ws ?? []).filter(w => w.tipos_usuario.es_trabajador);
        setTrabajadores(list);
        setSelectedId(list[0]?.id ?? user.id);
      } else {
        setSelectedId(user.id);
      }
    }
    init();
  }, [supabase]);

  // ── Load month data ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    const firstDay = `${viewAnio}-${p2(viewMes)}-01`;
    const lastDay  = `${viewAnio}-${p2(viewMes)}-${p2(lastDayOf(viewAnio, viewMes))}`;
    type F = { id: string; fecha: string; hora_entrada: string | null; hora_salida: string | null; minutos_trabajados: number };
    type A = Aprobacion;
    const [{ data: fs }, { data: apr }] = await Promise.all([
      (supabase.from("fichajes" as never)
        .select("id, fecha, hora_entrada, hora_salida, minutos_trabajados")
        .eq("id_empleado", selectedId)
        .gte("fecha", firstDay).lte("fecha", lastDay)
        .order("fecha", { ascending: false })
        .order("hora_entrada", { ascending: true })) as unknown as Promise<{ data: F[] | null }>,
      (supabase.from("aprobaciones_fichajes" as never)
        .select("estado, total_minutos, comentario")
        .eq("id_empleado", selectedId).eq("anio", viewAnio).eq("mes", viewMes)
        .maybeSingle()) as unknown as Promise<{ data: A | null }>,
    ]);
    setRows((fs ?? []).map(f => ({
      key: f.id,
      id: f.id,
      fecha: f.fecha,
      entrada: f.hora_entrada ? extractTime(f.hora_entrada) : "",
      salida:  f.hora_salida  ? extractTime(f.hora_salida)  : "",
      minutos: f.minutos_trabajados,
    })));
    setAprobacion(apr ?? null);
    setToDelete(new Set());
    setIsDirty(false);
    setLoading(false);
  }, [supabase, selectedId, viewAnio, viewMes]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Row operations ────────────────────────────────────────────────────────
  function updateRow(key: string, field: "entrada" | "salida", value: string) {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const updated = { ...r, [field]: value };
      updated.minutos = computeMin(updated.entrada, updated.salida);
      return updated;
    }));
    setIsDirty(true); setMsg(null);
  }

  function addRow(fecha: string) {
    const newRow: FichajeRow = { key: uid(), id: null, fecha, entrada: "", salida: "", minutos: 0 };
    setRows(prev => {
      const lastIdx = prev.map((r, i) => r.fecha === fecha ? i : -1).filter(i => i >= 0).at(-1);
      if (lastIdx === undefined) return [...prev, newRow];
      const next = [...prev];
      next.splice(lastIdx + 1, 0, newRow);
      return next;
    });
    setIsDirty(true); setMsg(null);
  }

  function removeRow(key: string, id: string | null) {
    setRows(prev => prev.filter(r => r.key !== key));
    if (id) setToDelete(prev => new Set([...prev, id]));
    setIsDirty(true); setMsg(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true); setMsg(null);
    for (const id of toDelete) {
      await (supabase.from("fichajes" as never).delete().eq("id", id));
    }
    for (const r of rows) {
      if (!r.entrada && !r.salida) continue;
      if (r.id) {
        await (supabase.from("fichajes" as never).update({
          hora_entrada:      r.entrada ? timeToISO(r.fecha, r.entrada) : null,
          hora_salida:       r.salida  ? timeToISO(r.fecha, r.salida)  : null,
          minutos_trabajados: r.minutos,
        } as never).eq("id", r.id));
      } else {
        await (supabase.from("fichajes" as never).insert({
          id_empleado:       selectedId,
          fecha:             r.fecha,
          hora_entrada:      r.entrada ? timeToISO(r.fecha, r.entrada) : null,
          hora_salida:       r.salida  ? timeToISO(r.fecha, r.salida)  : null,
          minutos_trabajados: r.minutos,
          es_manual:         true,
        } as never));
      }
    }
    await loadData();
    setMsg({ ok: true, text: "Cambios guardados." });
    setSaving(false);
  }

  // ── Month nav ─────────────────────────────────────────────────────────────
  const isCurrentMonth = viewAnio === today.getFullYear() && viewMes === today.getMonth() + 1;
  function prevMonth() {
    if (viewMes === 1) { setViewAnio(viewAnio - 1); setViewMes(12); } else setViewMes(viewMes - 1);
    setMsg(null);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (viewMes === 12) { setViewAnio(viewAnio + 1); setViewMes(1); } else setViewMes(viewMes + 1);
    setMsg(null);
  }

  // ── Approval ─────────────────────────────────────────────────────────────
  const totalMin = rows.reduce((s, r) => s + r.minutos, 0);
  const isOwnData = selectedId === currentUserId;
  const canEdit = isAdmin || (isOwnData && aprobacion?.estado !== "aprobado");

  async function handleAprobar() {
    setSaving(true);
    await (supabase.from("aprobaciones_fichajes" as never).upsert({
      id_empleado: selectedId, anio: viewAnio, mes: viewMes,
      total_minutos: totalMin, estado: "aprobado",
      id_aprobador: currentUserId, fecha_aprobacion: new Date().toISOString(), comentario: null,
    } as never, { onConflict: "id_empleado,anio,mes" }));
    loadData(); setSaving(false);
  }

  async function handleRechazar() {
    setSaving(true);
    await (supabase.from("aprobaciones_fichajes" as never).upsert({
      id_empleado: selectedId, anio: viewAnio, mes: viewMes,
      total_minutos: totalMin, estado: "rechazado",
      id_aprobador: currentUserId, fecha_aprobacion: new Date().toISOString(),
      comentario: rechazarComentario || null,
    } as never, { onConflict: "id_empleado,anio,mes" }));
    setShowRechazar(false); setRechazarComentario(""); loadData(); setSaving(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const maxDay = isCurrentMonth ? today.getDate() : lastDayOf(viewAnio, viewMes);
  const allDates = Array.from({ length: maxDay }, (_, i) => {
    const day = maxDay - i;
    return `${viewAnio}-${p2(viewMes)}-${p2(day)}`;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-3xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Fichajes</h1>
      <p className="mb-6" style={{ color: "#888780", fontSize: 13 }}>Registro de horas trabajadas</p>

      {/* Employee selector (admin only) */}
      {isAdmin && trabajadores.length > 0 && (
        <div className="mb-5">
          <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Empleado</label>
          <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setMsg(null); }}
            className={`${SELECT_CLS} w-full sm:w-72`}>
            {trabajadores.map(t => (
              <option key={t.id} value={t.id}>{t.nombre} {t.apellidos ?? ""}</option>
            ))}
          </select>
        </div>
      )}

      {/* Month nav + total + save */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-xl transition-colors">
            ‹
          </button>
          <span className="text-sm font-medium text-gray-800 capitalize w-36 text-center">
            {monthName(viewMes)} {viewAnio}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            ›
          </button>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm" style={{ color: "#888780" }}>
            Total: <strong className="text-gray-800">{fmtMin(totalMin)}</strong>
          </span>
          {canEdit && isDirty && (
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className="mb-3 rounded-lg px-4 py-2.5 text-sm"
          style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}>
          {msg.text}
        </div>
      )}

      {/* Approval banner (employee view) */}
      {!loading && !isAdmin && aprobacion && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: aprobacion.estado === "aprobado" ? "#F0FDF4" : aprobacion.estado === "rechazado" ? "#FEF2F2" : "#FEFCE8",
            color: aprobacion.estado === "aprobado" ? "#166534" : aprobacion.estado === "rechazado" ? "#991B1B" : "#854D0E",
          }}>
          {aprobacion.estado === "aprobado" ? "✓ Mes aprobado" : aprobacion.estado === "rechazado" ? "✗ Mes rechazado" : "⏳ Pendiente de aprobación"}
          {aprobacion.comentario && <span className="ml-2 font-normal italic">&ldquo;{aprobacion.comentario}&rdquo;</span>}
        </div>
      )}

      {/* Day list */}
      {loading ? (
        <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
      ) : (
        <div className="space-y-2 mb-8">
          {allDates.map(fecha => {
            const dayRows = rows.filter(r => r.fecha === fecha);
            const dt = dayRows.reduce((s, r) => s + r.minutos, 0);
            const d = new Date(`${fecha}T12:00:00`);
            const isToday = fecha === todayStr;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const dayLabel = d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });

            return (
              <div key={fecha} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
                {/* Day header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: "#f8f7f4" }}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium capitalize ${!isToday && isWeekend ? "text-gray-400" : !isToday ? "text-gray-700" : ""}`}
                      style={isToday ? { color: "var(--accent)" } : undefined}>
                      {dayLabel}
                    </span>
                    {isToday && (
                      <span className="text-white text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", fontSize: 10 }}>
                        Hoy
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${dt > 0 ? "text-gray-800" : "text-gray-300"}`}>
                    {dt > 0 ? fmtMin(dt) : "—"}
                  </span>
                </div>

                {/* Entry rows */}
                {dayRows.map(r => (
                  <div key={r.key} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: "1px solid #f0f0f0" }}>
                    <input type="time" value={r.entrada}
                      onChange={ev => updateRow(r.key, "entrada", ev.target.value)}
                      disabled={!canEdit} className={TIME_CLS} />
                    <span className="text-gray-300">→</span>
                    <input type="time" value={r.salida}
                      onChange={ev => updateRow(r.key, "salida", ev.target.value)}
                      disabled={!canEdit} className={TIME_CLS} />
                    <span className="text-xs font-medium text-gray-500 w-10 text-right flex-shrink-0">
                      {r.minutos > 0 ? fmtMin(r.minutos) : ""}
                    </span>
                    {canEdit && (
                      <button onClick={() => removeRow(r.key, r.id)}
                        className="ml-auto text-gray-200 hover:text-red-400 transition-colors text-sm flex-shrink-0"
                        title="Eliminar">
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {/* Add row */}
                {canEdit && (
                  <div className="px-4 py-2" style={{ borderTop: dayRows.length > 0 ? "1px solid #f0f0f0" : undefined }}>
                    <button onClick={() => addRow(fecha)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                      + Añadir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approval section (admin viewing employee) */}
      {!loading && isAdmin && !isOwnData && (
        <div className="rounded-xl p-4" style={{ border: "1px solid #e5e5e5" }}>
          <div className="text-sm font-medium text-gray-800 mb-3">Aprobación mensual</div>
          {aprobacion ? (
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium mb-3"
                style={{
                  backgroundColor: aprobacion.estado === "aprobado" ? "#F0FDF4" : aprobacion.estado === "rechazado" ? "#FEF2F2" : "#FEFCE8",
                  color: aprobacion.estado === "aprobado" ? "#166534" : aprobacion.estado === "rechazado" ? "#991B1B" : "#854D0E",
                }}>
                {aprobacion.estado === "aprobado" ? "✓ Aprobado" : aprobacion.estado === "rechazado" ? "✗ Rechazado" : "⏳ Pendiente"}
                {" — "}{fmtMin(aprobacion.total_minutos)}
              </div>
              {aprobacion.comentario && <p className="text-sm text-gray-500 mb-3 italic">&ldquo;{aprobacion.comentario}&rdquo;</p>}
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
              <p className="text-sm text-gray-500 mb-3">Sin aprobación. Total: <strong>{fmtMin(totalMin)}</strong></p>
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
              <input type="text" value={rechazarComentario} onChange={ev => setRechazarComentario(ev.target.value)}
                placeholder="Explica el motivo…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent mb-2" />
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
    </div>
  );
}
