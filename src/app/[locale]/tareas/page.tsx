"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, TrashIcon, CheckCircleIcon } from "@/components/ui/Icons";

type Granja = { id: string; nombre: string };
type Tarea = {
  id: string;
  descripcion: string;
  estado: "pendiente" | "resuelta";
  id_granja: string | null;
  created_at: string;
  granjas: { nombre: string } | null;
};

export default function TareasPage() {
  const supabase = useRef(createClient()).current;

  const [tareas, setTareas]   = useState<Tarea[]>([]);
  const [granjas, setGranjas] = useState<Granja[]>([]);
  const [loading, setLoading] = useState(true);

  const [desc, setDesc]     = useState("");
  const [granja, setGranja] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "pendiente" | "resuelta">("todas");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: g }] = await Promise.all([
      (supabase
        .from("tareas" as never)
        .select("id, descripcion, estado, id_granja, created_at, granjas(nombre)")
        .order("created_at", { ascending: false })) as unknown as Promise<{ data: Tarea[] | null }>,
      (supabase
        .from("granjas" as never)
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre")) as unknown as Promise<{ data: Granja[] | null }>,
    ]);
    setTareas(t ?? []);
    setGranjas(g ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!desc.trim()) return;
    setSaving(true);
    await (supabase
      .from("tareas" as never)
      .insert({ descripcion: desc.trim(), id_granja: granja || null } as never));
    setDesc(""); setGranja("");
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

  const visible = tareas.filter((t) =>
    filtro === "todas" ? true : t.estado === filtro
  );

  const nPendientes = tareas.filter((t) => t.estado === "pendiente").length;

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-gray-900" style={{ fontWeight: 500, fontSize: 22 }}>Tareas</h1>
        {nPendientes > 0 && (
          <span className="mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
            {nPendientes} pendiente{nPendientes > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="mb-6" style={{ color: "#888780", fontSize: 13 }}>
        Notas y tareas pendientes, opcionalmente asociadas a una granja
      </p>

      {/* Nueva tarea */}
      <div className="mb-6 p-4 rounded-xl" style={{ border: "1px solid #e5e5e5" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: "#888780" }}>Nueva tarea</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Descripción de la tarea…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={granja}
            onChange={(e) => setGranja(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-48"
          >
            <option value="">— Sin granja —</option>
            {granjas.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={saving || !desc.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors flex-shrink-0"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <PlusIcon className="h-4 w-4" />
            Añadir
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-4">
        {(["todas", "pendiente", "resuelta"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
            style={
              filtro === f
                ? { backgroundColor: "var(--accent)", color: "white" }
                : { backgroundColor: "#f5f5f5", color: "#555" }
            }
          >
            {f === "todas" ? "Todas" : f === "pendiente" ? "Pendientes" : "Resueltas"}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: "#888780" }}>Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: "#888780" }}>
          {filtro === "todas" ? "No hay tareas todavía" : `No hay tareas ${filtro === "pendiente" ? "pendientes" : "resueltas"}`}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((tarea) => {
            const resuelta = tarea.estado === "resuelta";
            return (
              <li
                key={tarea.id}
                className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                style={{ border: "1px solid #e5e5e5", backgroundColor: resuelta ? "#fafafa" : "white" }}
              >
                {/* Toggle estado */}
                <button
                  onClick={() => toggleEstado(tarea)}
                  title={resuelta ? "Marcar como pendiente" : "Marcar como resuelta"}
                  className="flex-shrink-0 mt-0.5 transition-colors"
                  style={{ color: resuelta ? "#22C55E" : "#D1D5DB" }}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm text-gray-800 leading-snug"
                    style={{ textDecoration: resuelta ? "line-through" : "none", color: resuelta ? "#9CA3AF" : undefined }}
                  >
                    {tarea.descripcion}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {tarea.granjas && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {tarea.granjas.nombre}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "#C0BDB9" }}>
                      {new Date(tarea.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
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
