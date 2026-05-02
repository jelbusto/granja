"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";

type TipoUsuario = {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_trabajador: boolean;
  activo: boolean;
};

type PermisoMenu = {
  id: string;
  ruta: string;
  puede_ver: boolean;
  puede_editar: boolean;
};

const RUTAS: { ruta: string; label: string; grupo?: string }[] = [
  { ruta: "dashboard",                     label: "Visión General" },
  { ruta: "produccion",                    label: "Datos de Producción" },
  { ruta: "economico",                     label: "Datos Económicos" },
  { ruta: "carga_datos",                   label: "Carga de Datos" },
  { ruta: "documentacion",                 label: "Documentación" },
  { ruta: "mantenimientos",                label: "Mantenimientos (grupo)", grupo: "mantenimientos" },
  { ruta: "mantenimientos/granjas",        label: "→ Granjas",             grupo: "mantenimientos" },
  { ruta: "mantenimientos/tipos_usuario",  label: "→ Tipos de Usuario",    grupo: "mantenimientos" },
  { ruta: "mantenimientos/usuarios",       label: "→ Usuarios",            grupo: "mantenimientos" },
  { ruta: "configuracion",                 label: "Configuración" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>
      {children}
    </span>
  );
}

const EMPTY_FORM: Omit<TipoUsuario, "id"> = {
  nombre: "",
  descripcion: "",
  es_trabajador: false,
  activo: true,
};

export default function TiposUsuarioPage() {
  const supabase = useRef(createClient()).current;

  const [tipos, setTipos] = useState<TipoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [permisos, setPermisos] = useState<PermisoMenu[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadTipos = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("tipos_usuario" as never).select("*").order("nombre")) as {
      data: TipoUsuario[] | null; error: unknown;
    };
    setTipos(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadTipos(); }, [loadTipos]);

  async function loadPermisos(idTipo: string) {
    const { data } = await (supabase
      .from("permisos_menu" as never)
      .select("id, ruta, puede_ver, puede_editar")
      .eq("id_tipo_usuario", idTipo)) as { data: PermisoMenu[] | null; error: unknown };
    // Fill missing rutas with defaults
    const map = Object.fromEntries((data ?? []).map((p) => [p.ruta, p]));
    setPermisos(
      RUTAS.map((r) => map[r.ruta] ?? { id: "", ruta: r.ruta, puede_ver: false, puede_editar: false })
    );
  }

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setPermisos(RUTAS.map((r) => ({ id: "", ruta: r.ruta, puede_ver: false, puede_editar: false })));
    setMsg(null);
    setShowForm(true);
  }

  async function openEdit(tipo: TipoUsuario) {
    setEditId(tipo.id);
    setForm({ nombre: tipo.nombre, descripcion: tipo.descripcion ?? "", es_trabajador: tipo.es_trabajador, activo: tipo.activo });
    await loadPermisos(tipo.id);
    setMsg(null);
    setShowForm(true);
  }

  function setPermiso(ruta: string, field: "puede_ver" | "puede_editar", value: boolean) {
    setPermisos((prev) =>
      prev.map((p) => {
        if (p.ruta !== ruta) return p;
        // Si desmarcas ver, desmarcar también editar
        if (field === "puede_ver" && !value) return { ...p, puede_ver: false, puede_editar: false };
        // Si marcas editar, marcar también ver
        if (field === "puede_editar" && value) return { ...p, puede_ver: true, puede_editar: true };
        return { ...p, [field]: value };
      })
    );
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setMsg({ ok: false, text: "El nombre es obligatorio." }); return; }
    setSaving(true);
    setMsg(null);

    let tipoId = editId;

    type DbResult<T> = { data: T; error: { message: string } | null };

    if (editId) {
      const { error } = await (supabase.from("tipos_usuario" as never).update(form as never).eq("id", editId)) as unknown as DbResult<null>;
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    } else {
      const { data, error } = await (supabase.from("tipos_usuario" as never).insert(form as never).select("id").single()) as unknown as DbResult<{ id: string } | null>;
      if (error || !data) { setMsg({ ok: false, text: error?.message ?? "Error" }); setSaving(false); return; }
      tipoId = data.id;
    }

    // Upsert permisos
    const rows = permisos.map((p) => ({
      id_tipo_usuario: tipoId,
      ruta: p.ruta,
      puede_ver: p.puede_ver,
      puede_editar: p.puede_editar,
    }));
    const { error: permError } = await (supabase
      .from("permisos_menu" as never)
      .upsert(rows as never, { onConflict: "id_tipo_usuario,ruta" })) as unknown as DbResult<null>;

    if (permError) { setMsg({ ok: false, text: permError.message }); setSaving(false); return; }

    setMsg({ ok: true, text: "Guardado correctamente." });
    loadTipos();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await (supabase.from("tipos_usuario" as never).delete().eq("id", id));
    setDeleteConfirm(null);
    if (editId === id) { setShowForm(false); setEditId(null); }
    loadTipos();
  }

  return (
    <div className="p-8 bg-white min-h-screen max-w-6xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Tipos de Usuario</h1>
      <p className="mb-8" style={{ color: "#888780", fontSize: 13 }}>Define los roles y sus permisos de acceso a cada sección</p>

      <div className="flex gap-6">
        {/* Lista */}
        <div className="w-64 flex-shrink-0">
          <button
            onClick={openNew}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <PlusIcon className="h-4 w-4" /> Nuevo tipo
          </button>

          {loading ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
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
                    <div>
                      <span className="font-medium">{t.nombre}</span>
                      <span className={`ml-2 text-xs ${editId === t.id ? "text-white/70" : "text-gray-400"}`}>
                        {t.es_trabajador ? "Trabajador" : "Cliente"}
                      </span>
                    </div>
                    {!t.activo && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
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
          <div className="flex-1 bg-white rounded-xl p-6" style={{ border: "1px solid #e5e5e5" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800">
                {editId ? "Editar tipo de usuario" : "Nuevo tipo de usuario"}
              </h2>
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
                <FieldLabel>Nombre</FieldLabel>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Ej. Veterinario"
                />
              </div>
              <div>
                <FieldLabel>Descripción</FieldLabel>
                <input
                  type="text"
                  value={form.descripcion ?? ""}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Descripción breve"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.es_trabajador} onChange={(e) => setForm({ ...form, es_trabajador: e.target.checked })}
                    className="rounded" />
                  Es trabajador
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    className="rounded" />
                  Activo
                </label>
              </div>
            </div>

            {/* Permisos */}
            <div className="mb-6">
              <FieldLabel>Permisos de acceso</FieldLabel>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e5e5" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: "#f8f7f4" }}>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>Sección</th>
                      <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-center w-24" style={{ color: "#888780" }}>Ver</th>
                      <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-center w-24" style={{ color: "#888780" }}>Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RUTAS.map((r, i) => {
                      const p = permisos.find((x) => x.ruta === r.ruta) ?? { puede_ver: false, puede_editar: false };
                      return (
                        <tr key={r.ruta} className={i % 2 === 0 ? "bg-white" : ""} style={{ borderTop: "1px solid #f0f0f0" }}>
                          <td className="px-4 py-2.5 text-sm text-gray-700">{r.label}</td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="checkbox" checked={p.puede_ver} onChange={(e) => setPermiso(r.ruta, "puede_ver", e.target.checked)} className="rounded" />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="checkbox" checked={p.puede_editar} onChange={(e) => setPermiso(r.ruta, "puede_editar", e.target.checked)} className="rounded" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {msg && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#3B6D11" : "#A32D2D" }}>
                {msg.text}
              </div>
            )}

            <div className="flex gap-3">
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
          </div>
        )}
      </div>
    </div>
  );
}
