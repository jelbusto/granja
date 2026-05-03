"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon } from "@/components/ui/Icons";

type TipoUsuario = { id: string; nombre: string; es_trabajador: boolean };
type Granja      = { id: string; nombre: string };
type AdminUser   = { id: string; nombre: string; apellidos: string | null };

type Usuario = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  n_colegiado: string | null;
  id_tipo_usuario: string | null;
  id_granja: string | null;
  id_aprobador: string | null;
  activo: boolean;
  color: string | null;
  tipos_usuario: { nombre: string } | null;
  granjas: { nombre: string } | null;
};

const COLOR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#F97316", "#EC4899", "#84CC16", "#14B8A6",
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "#888780" }}>
      {children}
    </span>
  );
}

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent";

export default function UsuariosPage() {
  const supabase = useRef(createClient()).current;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tipos, setTipos]       = useState<TipoUsuario[]>([]);
  const [granjas, setGranjas]   = useState<Granja[]>([]);
  const [admins, setAdmins]     = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);

  const [editId, setEditId]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew]       = useState(false);

  const [nombre, setNombre]         = useState("");
  const [apellidos, setApellidos]   = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [telefono, setTelefono]     = useState("");
  const [direccion, setDireccion]   = useState("");
  const [nColegiado, setNColegiado] = useState("");
  const [idTipo, setIdTipo]         = useState("");
  const [idGranja, setIdGranja]     = useState("");
  const [idAprobador, setIdAprobador] = useState("");
  const [activo, setActivo]         = useState(true);

  const [color, setColor]                 = useState("");

  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    type R<T> = Promise<{ data: T | null }>;
    const [{ data: u }, { data: t }, { data: g }, { data: adm }] = await Promise.all([
      supabase.from("usuarios_perfil" as never)
        .select("*, tipos_usuario(nombre), granjas(nombre)")
        .order("nombre") as unknown as R<Usuario[]>,
      supabase.from("tipos_usuario" as never)
        .select("id, nombre, es_trabajador")
        .eq("activo", true)
        .order("nombre") as unknown as R<TipoUsuario[]>,
      supabase.from("granjas" as never)
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre") as unknown as R<Granja[]>,
      supabase.from("usuarios_perfil" as never)
        .select("id, nombre, apellidos, tipos_usuario!inner(nombre)")
        .eq("activo", true)
        .eq("tipos_usuario.nombre", "Admin")
        .order("nombre") as unknown as R<AdminUser[]>,
    ]);
    setUsuarios(u ?? []);
    setTipos(t ?? []);
    setGranjas(g ?? []);
    setAdmins(adm ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const tipoSeleccionado = tipos.find((t) => t.id === idTipo);
  const esTrabajador     = tipoSeleccionado?.es_trabajador ?? true;

  function openNew() {
    setIsNew(true); setEditId(null);
    setNombre(""); setApellidos(""); setEmail(""); setPassword("");
    setTelefono(""); setDireccion(""); setNColegiado(""); setIdTipo(""); setIdGranja("");
    setIdAprobador(""); setActivo(true); setColor("");
    setMsg(null); setShowForm(true);
  }

  function openEdit(u: Usuario) {
    setIsNew(false); setEditId(u.id);
    setNombre(u.nombre); setApellidos(u.apellidos ?? ""); setEmail(u.email ?? "");
    setPassword(""); setTelefono(u.telefono ?? ""); setDireccion(u.direccion ?? "");
    setNColegiado(u.n_colegiado ?? "");
    setIdTipo(u.id_tipo_usuario ?? ""); setIdGranja(u.id_granja ?? "");
    setIdAprobador(u.id_aprobador ?? ""); setActivo(u.activo); setColor(u.color ?? "");
    setMsg(null); setShowForm(true);
  }

  async function handleSave() {
    if (!nombre.trim()) { setMsg({ ok: false, text: "El nombre es obligatorio." }); return; }
    if (isNew && !email.trim())    { setMsg({ ok: false, text: "El email es obligatorio." }); return; }
    if (isNew && !password.trim()) { setMsg({ ok: false, text: "La contraseña es obligatoria." }); return; }
    setSaving(true); setMsg(null);

    try {
      let userId = editId;

      if (isNew) {
        const res = await fetch("/api/admin/crear-usuario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, nombre }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Error al crear el usuario");
        }
        const created = await res.json() as { id: string };
        userId = created.id;
      }

      const { error: profileError } = await (supabase
        .from("usuarios_perfil" as never)
        .upsert({
          id: userId,
          nombre: nombre.trim(),
          apellidos:    apellidos.trim()   || null,
          email:        email.trim()       || null,
          telefono:     telefono.trim()    || null,
          direccion:    direccion.trim()   || null,
          n_colegiado:  nColegiado.trim()  || null,
          id_tipo_usuario: idTipo          || null,
          id_granja:    (!esTrabajador && idGranja) ? idGranja : null,
          id_aprobador: (esTrabajador && idAprobador) ? idAprobador : null,
          activo,
          color: (esTrabajador && color) ? color : null,
        } as never)) as unknown as { error: { message: string } | null };

      if (profileError) throw new Error(profileError.message);

      // Geocodificar la dirección en segundo plano
      const addr = direccion.trim();
      if (addr && userId) {
        fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`,
          { headers: { "User-Agent": "DairyPro/1.0" } }
        )
          .then((r) => r.json())
          .then((data: { lat: string; lon: string }[]) => {
            if (data.length) {
              (supabase
                .from("usuarios_perfil" as never)
                .update({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } as never)
                .eq("id", userId!) as unknown as Promise<unknown>
              ).catch(() => {});
            }
          })
          .catch(() => {});
      }

      setMsg({ ok: true, text: "Usuario guardado correctamente." });
      loadData();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await (supabase.from("usuarios_perfil" as never).delete().eq("id", id));
    setDeleteConfirm(null);
    if (editId === id) { setShowForm(false); setEditId(null); }
    loadData();
  }

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-6xl">
      <h1 className="text-gray-900 mb-1" style={{ fontWeight: 500, fontSize: 22 }}>Usuarios</h1>
      <p className="mb-8" style={{ color: "#888780", fontSize: 13 }}>Gestión de usuarios del sistema</p>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Lista */}
        <div className={`${showForm ? "hidden lg:block" : ""} w-full lg:w-72 lg:flex-shrink-0`}>
          <button onClick={openNew}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "var(--accent)" }}>
            <PlusIcon className="h-4 w-4" /> Nuevo usuario
          </button>

          {loading ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">Cargando…</p>
          ) : usuarios.length === 0 ? (
            <p style={{ color: "#888780", fontSize: 13 }} className="text-center py-8">No hay usuarios</p>
          ) : (
            <ul className="space-y-1">
              {usuarios.map((u) => (
                <li key={u.id}>
                  <button onClick={() => openEdit(u)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      editId === u.id ? "bg-accent text-white" : "hover:bg-gray-50 text-gray-700"
                    }`}>
                    <div className="font-medium truncate">{u.nombre} {u.apellidos}</div>
                    <div className={`text-xs truncate ${editId === u.id ? "text-white/70" : "text-gray-400"}`}>
                      {u.tipos_usuario?.nombre ?? "Sin rol"} {u.email ? `· ${u.email}` : ""}
                    </div>
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
                <button onClick={() => { setShowForm(false); setEditId(null); }}
                  className="lg:hidden text-gray-400 hover:text-gray-600 -ml-1 p-1">
                  ←
                </button>
                <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800">
                  {isNew ? "Nuevo usuario" : "Editar usuario"}
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
                <FieldLabel>Email {isNew && "*"}</FieldLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} placeholder="email@empresa.com" disabled={!isNew} />
              </div>
              {isNew && (
                <div>
                  <FieldLabel>Contraseña *</FieldLabel>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT_CLS} placeholder="Mínimo 8 caracteres" />
                </div>
              )}
              <div>
                <FieldLabel>Teléfono</FieldLabel>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={INPUT_CLS} placeholder="+34 600 000 000" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Dirección</FieldLabel>
                <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={INPUT_CLS} placeholder="Calle, número, ciudad, provincia" />
              </div>
              <div>
                <FieldLabel>Nº Colegiado</FieldLabel>
                <input type="text" value={nColegiado} onChange={(e) => setNColegiado(e.target.value)} className={INPUT_CLS} placeholder="Número de colegiado" />
              </div>
              <div>
                <FieldLabel>Tipo de usuario</FieldLabel>
                <select value={idTipo} onChange={(e) => setIdTipo(e.target.value)} className={INPUT_CLS}>
                  <option value="">— Sin asignar —</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              {/* Granja: solo para no-trabajadores (clientes) */}
              {!esTrabajador && idTipo && (
                <div>
                  <FieldLabel>Granja asignada</FieldLabel>
                  <select value={idGranja} onChange={(e) => setIdGranja(e.target.value)} className={INPUT_CLS}>
                    <option value="">— Sin asignar —</option>
                    {granjas.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </div>
              )}

              {/* Aprobador: solo para trabajadores */}
              {esTrabajador && idTipo && (
                <div>
                  <FieldLabel>Aprobador de gastos</FieldLabel>
                  <select value={idAprobador} onChange={(e) => setIdAprobador(e.target.value)} className={INPUT_CLS}>
                    <option value="">— Sin aprobador —</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre} {a.apellidos ?? ""}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs" style={{ color: "#888780" }}>Solo admins pueden aprobar gastos</p>
                </div>
              )}

              {/* Color de calendario: solo para trabajadores */}
              {esTrabajador && idTipo && (
                <div className="sm:col-span-2">
                  <FieldLabel>Color en calendario</FieldLabel>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(color === c ? "" : c)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 flex-shrink-0"
                        style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : "none", outlineOffset: 2 }}
                        title={c}
                      >
                        {color === c && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                            <polyline points="2 6 5 9 10 3" />
                          </svg>
                        )}
                      </button>
                    ))}
                    {color && (
                      <button type="button" onClick={() => setColor("")} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="rounded" />
                <label htmlFor="activo" className="text-sm text-gray-700 cursor-pointer">Usuario activo</label>
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
