"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────
type Trabajador = { id: string; nombre: string; apellidos: string | null };

type Fichaje = {
  id: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_trabajados: number;
};

type Aprobacion = {
  estado: "pendiente" | "aprobado" | "rechazado";
  total_minutos: number;
  comentario: string | null;
};

type DayEntry = {
  fecha: string;
  id: string | null;
  entrada: string; // "HH:MM" or ""
  salida: string;  // "HH:MM" or ""
  minutos: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function p2(n: number) { return n.toString().padStart(2, "0"); }
function lastDayOf(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function fmtMin(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function monthName(mes: number) {
  return new Date(2000, mes - 1, 1).toLocaleString("es", { month: "long" });
}
function extractTime(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : "";
}
function computeMinutes(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0;
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = salida.split(":").map(Number);
  const total = (sh * 60 + sm) - (eh * 60 + em);
  return total > 0 ? total : 0;
}
function timeToISO(dateStr: string, time: string): string {
  return `${dateStr}T${time}:00`;
}

const TIME_INPUT_CLS =
  "text-sm border border-gray-200 rounded-md px-1.5 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-50 disabled:text-gray-300 w-[84px]";
const SELECT_CLS =
  "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FichajesPage() {
  const supabase = useRef(createClient()).current;
  const today = useRef(new Date()).current;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [viewAnio, setViewAnio] = useState(today.getFullYear());
  const [viewMes, setViewMes] = useState(today.getMonth() + 1);

  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [aprobacion, setAprobacion] = useState<Aprobacion | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showRechazar, setShowRechazar] = useState(false);
  const [rechazarComentario, setRechazarComentario] = useState("");

  // ── Init: auth + profile + trabajadores ──────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      type P = { tipos_usuario: { nombre: string; es_trabajador: boolean } | null };
      const { data: perfil } = await (supabase
        .from("usuarios_perfil" as never)
        .select("tipos_usuario(nombre, es_trabajador)")
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

  // ── Load month data ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);

    const firstDay = `${viewAnio}-${p2(viewMes)}-01`;
    const lastDay  = `${viewAnio}-${p2(viewMes)}-${p2(lastDayOf(viewAnio, viewMes))}`;

    type F = Fichaje; type A = Aprobacion;
    const [{ data: fs }, { data: apr }] = await Promise.all([
      (supabase.from("fichajes" as never)
        .select("id, fecha, hora_entrada, hora_salida, minutos_trabajados")
        .eq("id_empleado", selectedId)
        .gte("fecha", firstDay)
        .lte("fecha", lastDay)
        .order("created_at", { ascending: false })) as unknown as Promise<{ data: F[] | null }>,
      (supabase.from("aprobaciones_fichajes" as never)
        .select("estado, total_minutos, comentario")
        .eq("id_empleado", selectedId)
        .eq("anio", viewAnio)
        .eq("mes", viewMes)
        .maybeSingle()) as unknown as Promise<{ data: A | null }>,
    ]);

    // One entry per day (take the most recent fichaje per day)
    const fichajeMap: Record<string, Fichaje> = {};
    for (const f of fs ?? []) {
      if (!fichajeMap[f.fecha]) fichajeMap[f.fecha] = f;
    }

    const isCurMonth = viewAnio === today.getFullYear() && viewMes === today.getMonth() + 1;
    const maxDay = isCurMonth ? today.getDate() : lastDayOf(viewAnio, viewMes);

    // Build entries newest-first
    const newEntries: DayEntry[] = Array.from({ length: maxDay }, (_, i) => {
      const day = maxDay - i;
      const fecha = `${viewAnio}-${p2(viewMes)}-${p2(day)}`;
      const f = fichajeMap[fecha];
      return {
        fecha,
        id: f?.id ?? null,
        entrada: f?.hora_entrada ? extractTime(f.hora_entrada) : "",
        salida:  f?.hora_salida  ? extractTime(f.hora_salida)  : "",
        minutos: f?.minutos_trabajados ?? 0,
      };
    });

    setEntries(newEntries);
    setAprobacion(apr ?? null);
    setDirty(new Set());
    setLoading(false);
  }, [supabase, selectedId, viewAnio, viewMes, today]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Edit ──────────────────────────────────────────────────────────────────
  function updateEntry(fecha: string, field: "entrada" | "salida", value: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.fecha !== fecha) return e;
        const updated = { ...e, [field]: value };
        updated.minutos = computeMinutes(updated.entrada, updated.salida);
        return updated;
      })
    );
    setDirty((prev) => new Set([...prev, fecha]));
    setMsg(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const toSave   = entries.filter((e) => dirty.has(e.fecha) && (e.entrada || e.salida));
    const toDelete = entries.filter((e) => dirty.has(e.fecha) && !e.entrada && !e.salida && e.id);

    setSaving(true); setMsg(null);

    for (const e of toSave) {
      if (e.id) {
        await (supabase.from("fichajes" as never).update({
          hora_entrada: e.entrada ? timeToISO(e.fecha, e.entrada) : null,
          hora_salida:  e.salida  ? timeToISO(e.fecha, e.salida)  : null,
          minutos_trabajados: e.minutos,
        } as never).eq("id", e.id));
      } else {
        const { data: ins } = await (supabase.from("fichajes" as never).insert({
          id_empleado: selectedId,
          fecha: e.fecha,
          hora_entrada: e.entrada ? timeToISO(e.fecha, e.entrada) : null,
          hora_salida:  e.salida  ? timeToISO(e.fecha, e.salida)  : null,
          minutos_trabajados: e.minutos,
          es_manual: true,
        } as never).select("id").single()) as unknown as { data: { id: string } | null };
        if (ins) setEntries((prev) => prev.map((x) => x.fecha === e.fecha ? { ...x, id: ins.id } : x));
      }
    }

    for (const e of toDelete) {
      await (supabase.from("fichajes" as never).delete().eq("id", e.id!));
      setEntries((prev) => prev.map((x) => x.fecha === e.fecha ? { ...x, id: null } : x));
    }

    setDirty(new Set());
    setMsg({ ok: true, text: "Cambios guardados." });
    setSaving(false);
  }

  // ── Month nav ─────────────────────────────────────────────────────────────
  const isCurrentMonth = viewAnio === today.getFullYear() && viewMes === today.getMonth() + 1;

  function prevMonth() {
    if (viewMes === 1) { setViewAnio(viewAnio - 1); setViewMes(12); }
    else setViewMes(viewMes - 1);
    setDirty(new Set()); setMsg(null);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (viewMes === 12) { setViewAnio(viewAnio + 1); setViewMes(1); }
    else setViewMes(viewMes + 1);
    setDirty(new Set()); setMsg(null);
  }

  // ── Approval ─────────────────────────────────────────────────────────────
  const totalMin = entries.reduce((s, e) => s + e.minutos, 0);
  const isOwnData = selectedId === currentUserId;
  const approved = aprobacion?.estado === "aprobado";
  const canEdit = isAdmin || (isOwnData && !approved);

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

  // ── Render ────────────────────────────────────────────────────────────────
  const todayStr = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-3xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Fichajes</h1>
      <p className="mb-6" style={{ color: "#888780", fontSize: 13 }}>Registro de horas trabajadas</p>

      {/* Employee selector (admin only) */}
      {isAdmin && trabajadores.length > 0 && (
        <div className="mb-5">
          <label className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Empleado</label>
          <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setDirty(new Set()); }}
            className={`${SELECT_CLS} w-full sm:w-72`}>
            {trabajadores.map((t) => (
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
          {canEdit && dirty.size > 0 && (
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}>
              {saving ? "Guardando…" : `Guardar (${dirty.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div className="mb-3 rounded-lg px-4 py-2.5 text-sm"
          style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}>
          {msg.text}
        </div>
      )}

      {/* Monthly approval banner (non-admin) */}
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

      {/* Day table */}
      {loading ? (
        <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
      ) : (
        <div className="rounded-xl overflow-hidden mb-8" style={{ border: "1px solid #e5e5e5" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#f8f7f4" }}>
                <th className="text-left px-3 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Día</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wide text-center" style={{ color: "#888780" }}>Entrada</th>
                <th className="px-2 py-2.5 text-xs font-medium uppercase tracking-wide text-center" style={{ color: "#888780" }}>Salida</th>
                <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-right" style={{ color: "#888780" }}>Horas</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const d = new Date(`${e.fecha}T12:00:00`);
                const isToday = e.fecha === todayStr;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isDirty = dirty.has(e.fecha);

                return (
                  <tr key={e.fecha}
                    style={{
                      borderTop: "1px solid #f0f0f0",
                      backgroundColor: i % 2 === 0 ? "white" : "#fafafa",
                    }}>
                    <td className="px-3 py-2 min-w-[90px]">
                      <span
                        className={`text-sm font-medium capitalize ${isToday ? "" : isWeekend ? "text-gray-400" : "text-gray-700"}`}
                        style={isToday ? { color: "var(--accent)" } : undefined}>
                        {d.toLocaleDateString("es", { weekday: "short", day: "numeric" })}
                      </span>
                      {isDirty && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-orange-400 align-middle" title="Sin guardar" />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="time"
                        value={e.entrada}
                        onChange={(ev) => updateEntry(e.fecha, "entrada", ev.target.value)}
                        disabled={!canEdit}
                        className={TIME_INPUT_CLS}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="time"
                        value={e.salida}
                        onChange={(ev) => updateEntry(e.fecha, "salida", ev.target.value)}
                        disabled={!canEdit}
                        className={TIME_INPUT_CLS}
                      />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <span className={`text-sm font-medium ${e.minutos > 0 ? "text-gray-800" : "text-gray-300"}`}>
                        {e.minutos > 0 ? fmtMin(e.minutos) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Approval section (admin viewing another employee) */}
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
                Sin aprobación registrada. Total acumulado: <strong>{fmtMin(totalMin)}</strong>
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
                onChange={(ev) => setRechazarComentario(ev.target.value)}
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
