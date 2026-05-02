"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon } from "@/components/ui/Icons";

type AdminUser = { id: string; nombre: string; apellidos: string | null };

type Empleado = {
  id: string;
  id_usuario: string | null;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  departamento: string | null;
  id_aprobador: string | null;
  activo: boolean;
  aprobador: { nombre: string; apellidos: string | null } | null;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>
      {children}
    </span>
  );
}

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

export default function EmpleadosPage() {
  const supabase = useRef(createClient()).current;

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [idAprobador, setIdAprobador] = useState("");
  const [activo, setActivo] = useState(true);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    type R<T> = Promise<{ data: T | null }>;

    // Load admins: users whose tipo is not es_trabajador=false AND has admin role
    // Actually load all active usuarios for aprobador selector, filtered by Admin type
    const [{ data: emp }, { data: adm }] = await Promise.all([
      supabase
        .from("empleados" as never)
        .select("*, aprobador:id_aprobador(nombre, apellidos)")
        .order("nombre") as unknown as R<Empleado[]>,
      supabase
        .from("usuarios_perfil" as never)
        .select("id, nombre, apellidos, tipos_usuario!inner(nombre)")
        .eq("activo", true)
        .eq("tipos_usuario.nombre", "Admin")
        .order("nombre") as unknown as R<AdminUser[]>,
    ]);

    setEmpleados(emp ?? []);
    setAdmins(adm ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  function openNew() {
    setIsNew(true); setEditId(null);
    setNombre(""); setApellidos(""); setEmail(""); setTelefono("");
    setDepartamento(""); setIdAprobador(""); setActivo(true);
    setMsg(null); setShowForm(true);
  }

  function openEdit(e: Empleado) {
    setIsNew(false); setEditId(e.id);
    setNombre(e.nombre); setApellidos(e.apellidos ?? ""); setEmail(e.email ?? "");
    setTelefono(e.telefono ?? ""); setDepartamento(e.departamento ?? "");
    setIdAprobador(e.id_aprobador ?? ""); setActivo(e.activo);
    setMsg(null); setShowForm(true);
  }

  async function handleSave() {
    if (!nombre.trim()) { setMsg({ ok: false, text: "El nombre es obligatorio." }); return; }
    setSaving(true); setMsg(null);

    const payload = {
      nombre: nombre.trim(),
      apellidos: apellidos.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      departamento: departamento.trim() || null,
      id_aprobador: idAprobador || null,
      activo,
    };

    try {
      if (isNew) {
        const { error } = await (supabase
          .from("empleados" as never)
          .insert(payload as never)) as unknown as { error: { message: string } | null };
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabase
          .from("empleados" as never)
          .update(payload as never)
          .eq("id", editId!)) as unknown as { error: { message: string } | null };
        if (error) throw new Error(error.message);
      }
      setMsg({ ok: true, text: "Empleado guardado correctamente." });
      loadData();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await (supabase.from("empleados" as never).delete().eq("id", id));
    setDeleteConfirm(null);
    if (editId === id) { setShowForm(false); setEditId(null); }
    loadData();
  }

  return (
    <div className="p-8 bg-white min-h-screen max-w-6xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Empleados</h1>
      <p className="mb-8" style={{ color: "#888780", fontSize: 13 }}>Gestión de empleados y aprobadores de gastos</p>

      <div className="flex gap-6">
        {/* Lista */}
        <div className="w-72 flex-shrink-0">
          <button onClick={openNew}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "var(--accent)" }}>
            <PlusIcon className="h-4 w-4" /> Nuevo empleado
          </button>

          {loading ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
          ) : empleados.length === 0 ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">No hay empleados</p>
          ) : (
            <ul className="space-y-1">
              {empleados.map((e) => (
                <li key={e.id}>
                  <button onClick={() => openEdit(e)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      editId === e.id ? "bg-accent text-white" : "hover:bg-gray-50 text-gray-700"
                    }`}>
                    <div className="font-medium truncate">{e.nombre} {e.apellidos}</div>
                    <div className={`text-xs truncate ${editId === e.id ? "text-white/70" : "text-gray-400"}`}>
                      {e.departamento ?? "Sin departamento"}
                      {!e.activo && " · Inactivo"}
                    </div>
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
                {isNew ? "Nuevo empleado" : "Editar empleado"}
              </h2>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <FieldLabel>Nombre *</FieldLabel>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT_CLS} placeholder="Nombre" />
              </div>
              <div>
                <FieldLabel>Apellidos</FieldLabel>
                <input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={INPUT_CLS} placeholder="Apellidos" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} placeholder="email@empresa.com" />
              </div>
              <div>
                <FieldLabel>Teléfono</FieldLabel>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={INPUT_CLS} placeholder="+34 600 000 000" />
              </div>
              <div>
                <FieldLabel>Departamento</FieldLabel>
                <input type="text" value={departamento} onChange={(e) => setDepartamento(e.target.value)} className={INPUT_CLS} placeholder="Ej. Comercial" />
              </div>
              <div>
                <FieldLabel>Aprobador de gastos</FieldLabel>
                <select value={idAprobador} onChange={(e) => setIdAprobador(e.target.value)} className={INPUT_CLS}>
                  <option value="">— Sin aprobador —</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} {a.apellidos ?? ""}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs" style={{ color: "#888780" }}>Solo se muestran usuarios de tipo Admin</p>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="rounded" />
                <label htmlFor="activo" className="text-sm text-gray-700 cursor-pointer">Empleado activo</label>
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
