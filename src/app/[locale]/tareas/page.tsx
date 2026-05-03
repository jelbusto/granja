"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon, CheckCircleIcon } from "@/components/ui/Icons";

type Empleado = { id: string; nombre: string; apellidos: string | null };
type Granja    = { id: string; nombre: string };
type Tarea     = {
  id: string;
  descripcion: string;
  estado: "pendiente" | "resuelta";
  id_empleado: string | null;
  id_granja: string | null;
  created_by: string | null;
  created_at: string;
  granjas: { nombre: string } | null;
};

export default function TareasPage() {
  const supabase = useRef(createClient()).current;

  const [tareas,    setTareas]    = useState<Tarea[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [granjas,   setGranjas]   = useState<Granja[]>([]);
  const [uid,       setUid]       = useState("");
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [loading,   setLoading]   = useState(true);

  // Form state
  const [desc,       setDesc]       = useState("");
  const [asignadoA,  setAsignadoA]  = useState("");
  const [granjaId,   setGranjaId]   = useState("");
  const [saving,     setSaving]     = useState(false);

  // Filter state
  const [filtroEstado,  setFiltroEstado]  = useState<"todas" | "pendiente" | "resuelta">("todas");
  const [filtroEmp,     setFiltroEmp]     = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const currentUid = user?.id ?? "";
    setUid(currentUid);
    if (asignadoA === "" && currentUid) setAsignadoA(currentUid);

    // Determine admin status: has any edit permission → is admin
    let admin = false;
    if (currentUid) {
      const { data: perfil } = await (supabase
        .from("usuarios_perfil" as never)
        .select("id_tipo_usuario")
        .eq("id", currentUid)
        .single()) as { data: { id_tipo_usuario: string | null } | null };

      if (perfil?.id_tipo_usuario) {
        const { data: perm } = await (supabase
          .from("permisos_menu" as never)
          .select("puede_editar")
          .eq("id_tipo_usuario", perfil.id_tipo_usuario)
          .eq("puede_editar", true)
          .limit(1)) as { data: { puede_editar: boolean }[] | null };
        admin = (perm?.length ?? 0) > 0;
      }
    }
    setIsAdmin(admin);

    const [{ data: t }, { data: e }, { data: g }] = await Promise.all([
      (supabase
        .from("tareas" as never)
        .select("id, descripcion, estado, id_empleado, id_granja, created_by, created_at, granjas(nombre)")
        .order("created_at", { ascending: false })) as unknown as Promise<{ data: Tarea[] | null }>,
      (supabase
        .from("usuarios_perfil" as never)
        .select("id, nombre, apellidos")
        .order("nombre")) as unknown as Promise<{ data: Empleado[] | null }>,
      (supabase
        .from("granjas" as never)
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre")) as unknown as Promise<{ data: Granja[] | null }>,
    ]);

    setTareas(t ?? []);
    setEmpleados(e ?? []);
    setGranjas(g ?? []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!desc.trim() || !asignadoA) return;
    setSaving(true);
    await (supabase
      .from("tareas" as never)
      .insert({
        descripcion: desc.trim(),
        id_empleado: asignadoA,
        id_granja:   granjaId || null,
        created_by:  uid || null,
      } as never));
    setDesc(""); setGranjaId("");
    setSaving(false);
    load();
  }

  async function toggleEstado(tarea: Tarea) {
    const nuevo = tarea.estado === "pendiente" ? "resuelta" : "pendiente";
    await (supabase
      .from("tareas" as never)
      .update({ estado: nuevo, updated_at: new Date().toISOString() } as never)
      .eq("id", tarea.id));
    load();
  }

  async function handleDelete(id: string) {
    await (supabase.from("tareas" as never).delete().eq("id", id));
    setDeleteConfirm(null);
    load();
  }

  function empNombre(id: string | null) {
    if (!id) return "—";
    const e = empleados.find(e => e.id === id);
    return e ? [e.nombre, e.apellidos].filter(Boolean).join(" ") : "—";
  }

  const visible = tareas.filter((t) => {
    if (filtroEstado !== "todas" && t.estado !== filtroEstado) return false;
    if (isAdmin && filtroEmp && t.id_empleado !== filtroEmp) return false;
    return true;
  });

  // Bell badge only counts tasks assigned to current user
  const nPropias = tareas.filter(t => t.estado === "pendiente" && t.id_empleado === uid).length;

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h1 style={{ fontWeight: 500, fontSize: 22, color: "#111" }}>Tareas</h1>
        {nPropias > 0 && (
          <span className="mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
            {nPropias} pendiente{nPropias > 1 ? "s" : ""} para mí
          </span>
        )}
      </div>
      <p className="mb-6" style={{ color: "#888780", fontSize: 13 }}>
        {isAdmin ? "Vista de administrador — todas las tareas" : "Tus tareas asignadas"}
      </p>

      {/* Formulario nueva tarea */}
      <div className="mb-6 p-4 rounded-xl" style={{ border: "1px solid #e5e5e5" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: "#888780" }}>
          Nueva tarea
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Descripción de la tarea…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Empleado (obligatorio) */}
            <select
              value={asignadoA}
              onChange={(e) => setAsignadoA(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Asignar a… (obligatorio) —</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {[e.nombre, e.apellidos].filter(Boolean).join(" ")}
                  {e.id === uid ? " (yo)" : ""}
                </option>
              ))}
            </select>
            {/* Granja (opcional) */}
            <select
              value={granjaId}
              onChange={(e) => setGranjaId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-52"
            >
              <option value="">— Sin granja —</option>
              {granjas.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={saving || !desc.trim() || !asignadoA}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors flex-shrink-0"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <PlusIcon className="h-4 w-4" />
              Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {(["todas", "pendiente", "resuelta"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroEstado(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={
                filtroEstado === f
                  ? { backgroundColor: "var(--accent)", color: "white" }
                  : { backgroundColor: "#f5f5f5", color: "#555" }
              }
            >
              {f === "todas" ? "Todas" : f === "pendiente" ? "Pendientes" : "Resueltas"}
            </button>
          ))}
        </div>

        {/* Filtro por empleado: solo admin */}
        {isAdmin && (
          <select
            value={filtroEmp}
            onChange={(e) => setFiltroEmp(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none"
          >
            <option value="">Todos los empleados</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {[e.nombre, e.apellidos].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: "#888780" }}>Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: "#888780" }}>
          No hay tareas
          {filtroEstado !== "todas" ? ` ${filtroEstado === "pendiente" ? "pendientes" : "resueltas"}` : ""}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((tarea) => {
            const resuelta = tarea.estado === "resuelta";
            const esParaMi = tarea.id_empleado === uid;

            return (
              <li
                key={tarea.id}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ border: "1px solid #e5e5e5", backgroundColor: resuelta ? "#fafafa" : "white" }}
              >
                {/* Toggle estado */}
                <button
                  onClick={() => toggleEstado(tarea)}
                  title={resuelta ? "Marcar pendiente" : "Marcar resuelta"}
                  className="flex-shrink-0 mt-0.5 transition-colors"
                  style={{ color: resuelta ? "#22C55E" : "#D1D5DB" }}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-snug"
                    style={{
                      color: resuelta ? "#9CA3AF" : "#1f2937",
                      textDecoration: resuelta ? "line-through" : "none",
                    }}
                  >
                    {tarea.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Empleado asignado */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={
                        esParaMi
                          ? { backgroundColor: "#EFF6FF", color: "#2563EB" }
                          : { backgroundColor: "#F3F4F6", color: "#6B7280" }
                      }
                    >
                      {esParaMi ? "Para mí" : empNombre(tarea.id_empleado)}
                    </span>
                    {/* Granja */}
                    {tarea.granjas && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {tarea.granjas.nombre}
                      </span>
                    )}
                    {/* Asignado por (si es diferente al destinatario) */}
                    {tarea.created_by && tarea.created_by !== tarea.id_empleado && (
                      <span className="text-xs" style={{ color: "#C0BDB9" }}>
                        de {empNombre(tarea.created_by)}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "#C0BDB9" }}>
                      {new Date(tarea.created_at).toLocaleDateString("es-ES", {
                        day: "numeric", month: "short",
                      })}
                    </span>
                  </div>
                </div>

                {/* Estado badge */}
                <span
                  className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={
                    resuelta
                      ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                      : { backgroundColor: "#FEF3C7", color: "#D97706" }
                  }
                >
                  {resuelta ? "Resuelta" : "Pendiente"}
                </span>

                {/* Eliminar */}
                {deleteConfirm === tarea.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleDelete(tarea.id)} className="text-xs text-red-600 font-medium hover:underline">Sí</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:underline">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(tarea.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
