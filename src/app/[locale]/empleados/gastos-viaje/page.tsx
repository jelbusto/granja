"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon, CheckCircleIcon } from "@/components/ui/Icons";

type Trabajador = { id: string; nombre: string; apellidos: string | null };

type Gasto = {
  id: string;
  id_empleado: string;
  fecha: string;
  tipo: string;
  descripcion: string | null;
  lugar: string | null;
  importe_total: number;
  porcentaje_iva: number;
  importe_sin_iva: number | null;
  importe_iva: number | null;
  foto_path: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  id_aprobador: string | null;
  fecha_aprobacion: string | null;
  comentario_rechazo: string | null;
  empleado: { nombre: string; apellidos: string | null } | null;
};

const TIPOS = [
  { value: "comida",     label: "Comida",     iva: 10 },
  { value: "kilometros", label: "Kilómetros", iva: 0  },
  { value: "billetes",   label: "Billetes",   iva: 10 },
  { value: "hotel",      label: "Hotel",      iva: 10 },
  { value: "otros",      label: "Otros",      iva: 21 },
];

const ESTADO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: "#FEF9C3", text: "#92400E", label: "Pendiente" },
  aprobado:  { bg: "#ECFDF5", text: "#3B6D11", label: "Aprobado"  },
  rechazado: { bg: "#FEF2F2", text: "#A32D2D", label: "Rechazado" },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>
      {children}
    </span>
  );
}

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

function calcIva(total: number, pct: number) {
  const sinIva = total / (1 + pct / 100);
  return {
    sinIva: Math.round(sinIva * 100) / 100,
    iva:    Math.round((total - sinIva) * 100) / 100,
  };
}

export default function GastosViajePage() {
  const supabase = useRef(createClient()).current;

  const [gastos, setGastos]           = useState<Gasto[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [loading, setLoading]         = useState(true);

  const [editId, setEditId]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew]       = useState(false);

  const [idEmpleado, setIdEmpleado]     = useState("");
  const [fecha, setFecha]               = useState(new Date().toISOString().split("T")[0]);
  const [tipo, setTipo]                 = useState("comida");
  const [descripcion, setDescripcion]   = useState("");
  const [lugar, setLugar]               = useState("");
  const [importeTotal, setImporteTotal] = useState("");
  const [porcentajeIva, setPorcentajeIva] = useState("10");
  const [fotoFile, setFotoFile]         = useState<File | null>(null);
  const [fotoPreview, setFotoPreview]   = useState<string | null>(null);
  const [fotoPath, setFotoPath]         = useState<string | null>(null);

  const [recognizing, setRecognizing]   = useState(false);
  const [ocrMsg, setOcrMsg]             = useState<string | null>(null);

  const [comentarioRechazo, setComentarioRechazo] = useState("");
  const [showRejectInput, setShowRejectInput]     = useState<string | null>(null);

  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState("todos");

  const loadData = useCallback(async () => {
    setLoading(true);
    type R<T> = Promise<{ data: T | null }>;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data: perfil } = await (supabase
      .from("usuarios_perfil" as never)
      .select("id_tipo_usuario, tipos_usuario(nombre)")
      .eq("id", user.id)
      .single()) as { data: { id_tipo_usuario: string | null; tipos_usuario: { nombre: string } | null } | null; error: unknown };

    const tipoNombre = (perfil as { tipos_usuario?: { nombre?: string } | null } | null)?.tipos_usuario?.nombre ?? null;
    const admin = tipoNombre === "Admin";
    setIsAdmin(admin);

    // Trabajadores = usuarios con tipo es_trabajador = true
    const { data: todosUsuarios } = await (supabase
      .from("usuarios_perfil" as never)
      .select("id, nombre, apellidos, activo, tipos_usuario(es_trabajador)")
      .eq("activo", true)
      .order("nombre")) as { data: (Trabajador & { tipos_usuario: { es_trabajador: boolean } | null })[] | null; error: unknown };

    const trabajadoresFiltrados = (todosUsuarios ?? []).filter(
      (u) => (u as { tipos_usuario?: { es_trabajador?: boolean } | null }).tipos_usuario?.es_trabajador === true
    );
    setTrabajadores(trabajadoresFiltrados);

    const [{ data: g }] = await Promise.all([
      supabase
        .from("gastos_viaje" as never)
        .select("*, empleado:id_empleado(nombre, apellidos)")
        .order("fecha", { ascending: false }) as unknown as R<Gasto[]>,
    ]);

    setGastos(g ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  function resetForm() {
    setIdEmpleado(""); setFecha(new Date().toISOString().split("T")[0]);
    setTipo("comida"); setDescripcion(""); setLugar("");
    setImporteTotal(""); setPorcentajeIva("10");
    setFotoFile(null); setFotoPreview(null); setFotoPath(null);
    setOcrMsg(null); setMsg(null);
  }

  function openNew() {
    setIsNew(true); setEditId(null);
    resetForm();
    // Pre-select current user if they are a trabajador
    const meAsTrabajador = trabajadores.find((t) => t.id === currentUserId);
    if (meAsTrabajador) setIdEmpleado(meAsTrabajador.id);
    setShowForm(true);
  }

  function openEdit(g: Gasto) {
    setIsNew(false); setEditId(g.id);
    setIdEmpleado(g.id_empleado); setFecha(g.fecha);
    setTipo(g.tipo); setDescripcion(g.descripcion ?? "");
    setLugar(g.lugar ?? ""); setImporteTotal(String(g.importe_total));
    setPorcentajeIva(String(g.porcentaje_iva));
    setFotoPath(g.foto_path);
    setFotoFile(null); setFotoPreview(null); setOcrMsg(null); setMsg(null);
    setShowForm(true);
  }

  function handleTipoChange(t: string) {
    setTipo(t);
    const def = TIPOS.find((x) => x.value === t);
    if (def) setPorcentajeIva(String(def.iva));
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFotoFile(file);
    setFotoPreview(file ? URL.createObjectURL(file) : null);
    setOcrMsg(null);
  }

  async function handleRecognize() {
    if (!fotoFile) return;
    setRecognizing(true);
    setOcrMsg("Reconociendo con IA…");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(fotoFile);
      });
      const res = await fetch("/api/reconocer-factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: fotoFile.type }),
      });
      if (!res.ok) throw new Error("Error al reconocer la factura");
      const data = await res.json() as {
        fecha?: string; tipo?: string; descripcion?: string;
        lugar?: string; importe_total?: number;
      };
      if (data.fecha) setFecha(data.fecha);
      if (data.tipo && TIPOS.some((t) => t.value === data.tipo)) handleTipoChange(data.tipo);
      if (data.descripcion) setDescripcion(data.descripcion);
      if (data.lugar) setLugar(data.lugar);
      if (data.importe_total != null) setImporteTotal(String(data.importe_total));
      setOcrMsg("Campos extraídos. Revisa y ajusta si es necesario.");
    } catch (err) {
      setOcrMsg(err instanceof Error ? err.message : "Error al reconocer");
    }
    setRecognizing(false);
  }

  async function handleSave() {
    if (!idEmpleado) { setMsg({ ok: false, text: "Selecciona un empleado." }); return; }
    if (!fecha)      { setMsg({ ok: false, text: "La fecha es obligatoria." }); return; }
    const total = parseFloat(importeTotal);
    if (isNaN(total) || total <= 0) { setMsg({ ok: false, text: "El importe debe ser mayor que 0." }); return; }
    setSaving(true); setMsg(null);

    try {
      let uploadedPath = fotoPath;
      if (fotoFile) {
        const ext = fotoFile.name.split(".").pop() ?? "jpg";
        const { error: upErr } = await supabase.storage
          .from("gastos-viaje")
          .upload(`${Date.now()}.${ext}`, fotoFile, { upsert: true });
        if (upErr) throw new Error(`Error subiendo foto: ${upErr.message}`);
        uploadedPath = `${Date.now()}.${ext}`;
      }

      const pct = parseFloat(porcentajeIva) || 0;
      const { sinIva, iva } = calcIva(total, pct);
      const estadoInicial = isAdmin ? "aprobado" : "pendiente";
      const aprobadorId   = isAdmin ? currentUserId : null;
      const fechaAprobado = isAdmin ? new Date().toISOString() : null;

      const payload = {
        id_empleado:     idEmpleado,
        fecha, tipo,
        descripcion:     descripcion.trim() || null,
        lugar:           lugar.trim() || null,
        importe_total:   total,
        porcentaje_iva:  pct,
        importe_sin_iva: sinIva,
        importe_iva:     iva,
        foto_path:       uploadedPath,
        estado:          estadoInicial,
        id_aprobador:    aprobadorId,
        fecha_aprobacion: fechaAprobado,
      };

      if (isNew) {
        const { error } = await (supabase
          .from("gastos_viaje" as never)
          .insert(payload as never)) as unknown as { error: { message: string } | null };
        if (error) throw new Error(error.message);
      } else {
        // Don't overwrite approval fields on edit
        const { estado: _e, id_aprobador: _a, fecha_aprobacion: _f, ...editPayload } = payload;
        void _e; void _a; void _f;
        const { error } = await (supabase
          .from("gastos_viaje" as never)
          .update(editPayload as never)
          .eq("id", editId!)) as unknown as { error: { message: string } | null };
        if (error) throw new Error(error.message);
      }

      setMsg({ ok: true, text: "Gasto guardado correctamente." });
      loadData();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setSaving(false);
  }

  async function handleApprove(id: string) {
    await (supabase
      .from("gastos_viaje" as never)
      .update({
        estado: "aprobado",
        id_aprobador: currentUserId,
        fecha_aprobacion: new Date().toISOString(),
        comentario_rechazo: null,
      } as never)
      .eq("id", id)) as unknown as { error: unknown };
    loadData();
  }

  async function handleReject(id: string) {
    await (supabase
      .from("gastos_viaje" as never)
      .update({
        estado: "rechazado",
        id_aprobador: currentUserId,
        fecha_aprobacion: new Date().toISOString(),
        comentario_rechazo: comentarioRechazo.trim() || null,
      } as never)
      .eq("id", id)) as unknown as { error: unknown };
    setShowRejectInput(null); setComentarioRechazo(""); loadData();
  }

  async function handleDelete(id: string) {
    await (supabase.from("gastos_viaje" as never).delete().eq("id", id));
    setDeleteConfirm(null);
    if (editId === id) { setShowForm(false); setEditId(null); }
    loadData();
  }

  const filtered = gastos.filter((g) => filterEstado === "todos" || g.estado === filterEstado);
  const totalPendiente = gastos.filter((g) => g.estado === "pendiente").reduce((s, g) => s + g.importe_total, 0);
  const pct   = parseFloat(porcentajeIva) || 0;
  const total = parseFloat(importeTotal)  || 0;
  const { sinIva, iva } = calcIva(total, pct);

  const currentGasto = gastos.find((x) => x.id === editId);

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1">
        <h1 className="text-gray-900" style={{ fontWeight: 500, fontSize: 22 }}>Gastos de Viaje</h1>
        {isAdmin && totalPendiente > 0 && (
          <div className="rounded-lg px-3 py-1.5 text-sm self-start" style={{ backgroundColor: "#FEF9C3", color: "#92400E" }}>
            Pendiente: <strong>{totalPendiente.toFixed(2)} €</strong>
          </div>
        )}
      </div>
      <p className="mb-6" style={{ color: "#888780", fontSize: 13 }}>Registro y gestión de gastos de viaje</p>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Lista */}
        <div className={`${showForm ? "hidden lg:block" : ""} w-full lg:w-80 lg:flex-shrink-0`}>
          <button onClick={openNew}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "var(--accent)" }}>
            <PlusIcon className="h-4 w-4" /> Nuevo gasto
          </button>

          <div className="flex gap-1 mb-3">
            {["todos", "pendiente", "aprobado", "rechazado"].map((e) => (
              <button key={e} onClick={() => setFilterEstado(e)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  filterEstado === e ? "bg-accent text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {e === "todos" ? "Todos" : ESTADO_COLORS[e]?.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">No hay gastos</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((g) => {
                const ec = ESTADO_COLORS[g.estado];
                return (
                  <li key={g.id}>
                    <button onClick={() => openEdit(g)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        editId === g.id ? "bg-accent text-white" : "hover:bg-gray-50 text-gray-700"
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{g.empleado?.nombre} {g.empleado?.apellidos}</span>
                        <span className="text-xs font-medium ml-1 flex-shrink-0">{g.importe_total.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-xs ${editId === g.id ? "text-white/70" : "text-gray-400"}`}>
                          {TIPOS.find((t) => t.value === g.tipo)?.label} · {g.fecha}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{ backgroundColor: ec.bg, color: ec.text }}>
                          {ec.label}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="flex-1 min-w-0 bg-white rounded-xl p-4 sm:p-6" style={{ border: "1px solid #e5e5e5" }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowForm(false); setEditId(null); }}
                  className="lg:hidden text-gray-400 hover:text-gray-600 -ml-1 p-1">
                  ←
                </button>
                <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800">
                  {isNew ? "Nuevo gasto" : "Editar gasto"}
                </h2>
              </div>
              {!isNew && editId && (
                deleteConfirm === editId ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(editId)} className="text-xs text-red-600 hover:underline font-medium">Confirmar eliminación</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(editId)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )
              )}
            </div>

            {/* Foto + OCR */}
            <div className="mb-5">
              <FieldLabel>Foto de la factura</FieldLabel>
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <input type="file" accept="image/*" onChange={handleFotoChange}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
                  {ocrMsg && (
                    <p className="mt-1.5 text-xs" style={{ color: ocrMsg.includes("Error") ? "#A32D2D" : "#3B6D11" }}>{ocrMsg}</p>
                  )}
                  {fotoFile && (
                    <button onClick={handleRecognize} disabled={recognizing}
                      className="mt-2 px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: "var(--accent)" }}>
                      {recognizing ? "Reconociendo…" : "Reconocer con IA"}
                    </button>
                  )}
                </div>
                {(fotoPreview || fotoPath) && (
                  <img
                    src={fotoPreview ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gastos-viaje/${fotoPath}`}
                    alt="Factura"
                    className="h-24 w-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <FieldLabel>Empleado *</FieldLabel>
                <select value={idEmpleado} onChange={(e) => setIdEmpleado(e.target.value)} className={INPUT_CLS}>
                  <option value="">— Seleccionar —</option>
                  {trabajadores.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre} {t.apellidos ?? ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Fecha *</FieldLabel>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <FieldLabel>Tipo *</FieldLabel>
                <select value={tipo} onChange={(e) => handleTipoChange(e.target.value)} className={INPUT_CLS}>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Lugar</FieldLabel>
                <input type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} className={INPUT_CLS} placeholder="Establecimiento o lugar" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Descripción</FieldLabel>
                <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={INPUT_CLS} placeholder="Descripción del gasto" />
              </div>
              <div>
                <FieldLabel>Importe total (€) *</FieldLabel>
                <input type="number" step="0.01" min="0" value={importeTotal}
                  onChange={(e) => setImporteTotal(e.target.value)} className={INPUT_CLS} placeholder="0.00" />
              </div>
              <div>
                <FieldLabel>% IVA</FieldLabel>
                <input type="number" step="1" min="0" max="100" value={porcentajeIva}
                  onChange={(e) => setPorcentajeIva(e.target.value)} className={INPUT_CLS} />
              </div>
            </div>

            {total > 0 && (
              <div className="mb-5 rounded-lg p-3 grid grid-cols-3 gap-3 text-center text-sm" style={{ backgroundColor: "#f8f7f4" }}>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: "#888780" }}>Sin IVA</div>
                  <div className="font-semibold text-gray-800">{sinIva.toFixed(2)} €</div>
                </div>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: "#888780" }}>IVA ({pct}%)</div>
                  <div className="font-semibold text-gray-800">{iva.toFixed(2)} €</div>
                </div>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: "#888780" }}>Total</div>
                  <div className="font-semibold text-gray-800">{total.toFixed(2)} €</div>
                </div>
              </div>
            )}

            {msg && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}>
                {msg.text}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
            </div>

            {/* Aprobación — solo admin, solo gastos pendientes */}
            {isAdmin && !isNew && currentGasto?.estado === "pendiente" && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Aprobación</p>
                <div className="flex gap-3 flex-wrap items-center">
                  <button onClick={() => handleApprove(editId!)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: "#3B6D11" }}>
                    <CheckCircleIcon className="h-4 w-4" /> Aprobar
                  </button>
                  {showRejectInput === editId ? (
                    <div className="flex gap-2 items-center flex-1">
                      <input type="text" value={comentarioRechazo}
                        onChange={(e) => setComentarioRechazo(e.target.value)}
                        placeholder="Motivo del rechazo (opcional)"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent" />
                      <button onClick={() => handleReject(editId!)}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-white"
                        style={{ backgroundColor: "#A32D2D" }}>
                        Confirmar
                      </button>
                      <button onClick={() => setShowRejectInput(null)}
                        className="px-3 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setShowRejectInput(editId!)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border"
                      style={{ borderColor: "#A32D2D", color: "#A32D2D" }}>
                      Rechazar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Motivo de rechazo */}
            {!isNew && currentGasto?.estado === "rechazado" && currentGasto.comentario_rechazo && (
              <div className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#FEF2F2", color: "#A32D2D" }}>
                Motivo de rechazo: {currentGasto.comentario_rechazo}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
