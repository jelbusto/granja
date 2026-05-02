"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon } from "@/components/ui/Icons";

type TipoActividad = {
  id: string;
  nombre: string;
  activo: boolean;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>
      {children}
    </span>
  );
}

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

const EMPTY_FORM = { nombre: "", activo: true };

export default function TiposActividadPage() {
  const supabase = useRef(createClient()).current;

  const [tipos, setTipos] = useState<TipoActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadTipos = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("tipos_actividad" as never)
      .select("id, nombre, activo")
      .order("nombre")) as { data: TipoActividad[] | null; error: unknown };
    setTipos(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadTipos(); }, [loadTipos]);

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setDeleteConfirm(null);
    setShowForm(true);
  }

  function openEdit(tipo: TipoActividad) {
    setEditId(tipo.id);
    setForm({ nombre: tipo.nombre, activo: tipo.activo });
    setMsg(null);
    setDeleteConfirm(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setMsg({ ok: false, text: "El nombre es obligatorio." }); return; }
    setSaving(true); setMsg(null);

    type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

    if (editId) {
      const { error } = await (supabase
        .from("tipos_actividad" as never)
        .update(form as never)
        .eq("id", editId)) as unknown as DbResult<null>;
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    } else {
      const { error } = await (supabase
        .from("tipos_actividad" as never)
        .insert(form as never)) as unknown as DbResult<null>;
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    }

    setMsg({ ok: true, text: "Guardado correctamente." });
    loadTipos();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await (supabase.from("tipos_actividad" as never).delete().eq("id", id));
    setDeleteConfirm(null);
    if (editId === id) { setShowForm(false); setEditId(null); }
    loadTipos();
  }

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-4xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Tipos de Actividad</h1>
      <p className="mb-8" style={{ color: "#888780", fontSize: 13 }}>Define las categorías de actividades del calendario</p>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Lista */}
        <div className={`${showForm ? "hidden lg:block" : ""} w-full lg:w-64 lg:flex-shrink-0`}>
          <button
            onClick={openNew}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <PlusIcon className="h-4 w-4" /> Nuevo tipo
          </button>

          {loading ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
          ) : tipos.length === 0 ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">No hay tipos definidos</p>
          ) : (
            <ul className="space-y-1">
              {tipos.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => openEdit(t)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                      editId === t.id ? "bg-accent text-white" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className="font-medium truncate">{t.nombre}</span>
                    {!t.activo && (
                      <span className="text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                        Inactivo
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="flex-1 min-w-0 bg-white rounded-xl p-4 sm:p-6" style={{ border: "1px solid #e5e5e5" }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowForm(false); setEditId(null); }}
                  className="lg:hidden text-gray-400 hover:text-gray-600 -ml-1 p-1"
                >
                  ←
                </button>
                <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800">
                  {editId ? "Editar tipo de actividad" : "Nuevo tipo de actividad"}
                </h2>
              </div>
              {editId && (
                <div className="flex gap-2">
                  {deleteConfirm === editId ? (
                    <>
                      <button onClick={() => handleDelete(editId)} className="text-xs text-red-600 hover:underline font-medium">Confirmar eliminación</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(editId)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <FieldLabel>Nombre *</FieldLabel>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="Ej. Visita repro"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="activo" className="text-sm text-gray-700 cursor-pointer">Activo</label>
              </div>
            </div>

            {msg && (
              <div
                className="mb-4 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}
              >
                {msg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
