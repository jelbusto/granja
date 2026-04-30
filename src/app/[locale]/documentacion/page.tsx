"use client";

/*
  SQL migration — supabase/migrations/documentos.sql:

  CREATE TABLE IF NOT EXISTS documentos (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT        NOT NULL,
    tipo_archivo  TEXT        NOT NULL CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint', 'imagen')),
    categoria     TEXT        NOT NULL CHECK (categoria IN ('informe_tecnico', 'otros')),
    fecha_subida  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subido_por    TEXT        NOT NULL DEFAULT 'Javier Heras',
    tamano_bytes  BIGINT,
    url_archivo   TEXT,
    id_granja     UUID        REFERENCES granjas(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  Storage bucket "documentos" must exist and be public.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DocumentIcon, TrashIcon } from "@/components/ui/Icons";

type TipoArchivo = "pdf" | "word" | "powerpoint" | "imagen";
type Categoria = "informe_tecnico" | "otros";

type Documento = {
  id: string;
  nombre: string;
  tipo_archivo: TipoArchivo;
  categoria: Categoria;
  fecha_subida: string;
  subido_por: string;
  tamano_bytes: number | null;
  url_archivo: string | null;
  id_granja: string | null;
  granjas?: { nombre: string } | null;
};

const USUARIO_ACTUAL = "Javier Heras";

function detectTipo(file: File): TipoArchivo {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["ppt", "pptx"].includes(ext)) return "powerpoint";
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif", "webp"].includes(ext))
    return "imagen";
  return "pdf";
}

const TIPO_LABEL: Record<TipoArchivo, string> = { pdf: "PDF", word: "Word", powerpoint: "PPT", imagen: "Foto" };
const TIPO_COLOR: Record<TipoArchivo, string> = {
  pdf: "#DC2626",
  word: "#2563EB",
  powerpoint: "#D97706",
  imagen: "#059669",
};
const CAT_LABEL: Record<Categoria, string> = { informe_tecnico: "Informe Técnico", otros: "Otros" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{ color: "#888780", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}
      className="block mb-1.5"
    >
      {children}
    </span>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="pb-2 font-medium whitespace-nowrap text-left pr-4"
      style={{ color: "#888780", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-3 pr-4 whitespace-nowrap text-gray-700" style={{ fontSize: 13 }}>
      {children}
    </td>
  );
}

function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export default function DocumentacionPage() {
  const supabase = useRef(createClient()).current;

  const [granjas, setGranjas] = useState<{ id: string; nombre: string }[]>([]);
  const [granjaSeleccionada, setGranjaSeleccionada] = useState("");
  const [granjaFiltro, setGranjaFiltro] = useState("todas");

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("informe_tecnico");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("granjas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const g = (data ?? []) as { id: string; nombre: string }[];
        setGranjas(g);
        if (g.length) setGranjaSeleccionada(g[0].id);
      });
  }, [supabase]);

  const loadDocumentos = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("documentos")
      .select("*, granjas(nombre)")
      .order("fecha_subida", { ascending: false });
    if (granjaFiltro !== "todas") q = q.eq("id_granja", granjaFiltro);
    const { data, error } = await q;
    if (!error) setDocumentos((data ?? []) as Documento[]);
    setLoading(false);
  }, [supabase, granjaFiltro]);

  useEffect(() => {
    loadDocumentos();
  }, [loadDocumentos]);

  async function uploadFile(file: File) {
    if (!granjaSeleccionada) {
      setUploadMsg({ ok: false, text: "Selecciona una granja antes de subir." });
      return;
    }
    setUploading(true);
    setUploadMsg(null);

    const tipo = detectTipo(file);
    const now = new Date();
    const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
    const nombre = tipo === "imagen" ? `foto_${dateStr}` : file.name;
    const fileName = `${granjaSeleccionada}/${Date.now()}_${file.name}`;

    let url_archivo: string | null = null;
    const { data: storageData, error: storageError } = await supabase.storage
      .from("documentos")
      .upload(fileName, file, { contentType: file.type });

    if (!storageError && storageData) {
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(fileName);
      url_archivo = publicUrl;
    }

    const { error: dbError } = await supabase.from("documentos").insert({
      nombre,
      tipo_archivo: tipo,
      categoria,
      fecha_subida: new Date().toISOString(),
      subido_por: USUARIO_ACTUAL,
      tamano_bytes: file.size,
      url_archivo,
      id_granja: granjaSeleccionada,
    } as never);

    if (dbError) {
      setUploadMsg({ ok: false, text: `Error al guardar: ${dbError.message}` });
    } else {
      setUploadMsg({ ok: true, text: `"${nombre}" subido correctamente.` });
      loadDocumentos();
    }
    setUploading(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function handleDelete(doc: Documento) {
    if (doc.url_archivo) {
      const match = doc.url_archivo.match(/\/documentos\/(.+)$/);
      if (match) await supabase.storage.from("documentos").remove([decodeURIComponent(match[1])]);
    }
    const { error } = await supabase.from("documentos").delete().eq("id", doc.id);
    if (!error) setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleteConfirm(null);
  }

  return (
    <div className="p-8 bg-white min-h-screen max-w-7xl">
      <h1 style={{ fontWeight: 500, fontSize: 22 }} className="text-gray-900 mb-1">
        Documentación
      </h1>
      <p style={{ color: "#888780", fontSize: 13 }} className="mb-8">
        Documentos y fotos asociados a las granjas
      </p>

      {/* Upload card */}
      <div className="bg-white rounded-xl p-6 mb-6" style={{ border: "1px solid #e5e5e5" }}>
        <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800 mb-5">
          Subir archivo
        </h2>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col gap-4 flex-1">
            {/* Granja selector */}
            <div>
              <FieldLabel>Granja</FieldLabel>
              <select
                value={granjaSeleccionada}
                onChange={(e) => setGranjaSeleccionada(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {granjas.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>

            {/* Category selector */}
            <div>
              <FieldLabel>Categoría</FieldLabel>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as Categoria)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="informe_tecnico">Informe Técnico</option>
                <option value="otros">Otros</option>
              </select>
            </div>

            {/* Upload zones */}
            <div>
              <FieldLabel>Archivo</FieldLabel>

              {/* Hidden inputs */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setUploadMsg(null); fileRef.current?.click(); }}
                  disabled={uploading || !granjaSeleccionada}
                  className="border-2 border-dashed border-gray-200 rounded-xl py-6 hover:border-gray-300 transition-colors disabled:opacity-50"
                >
                  <div className="flex flex-col items-center gap-2">
                    <DocumentIcon className="h-7 w-7 text-gray-300" />
                    <span style={{ color: "#888780", fontSize: 13 }}>Documento</span>
                    <span style={{ color: "#aaa9a5", fontSize: 11 }}>PDF · Word · PowerPoint</span>
                  </div>
                </button>

                <button
                  onClick={() => { setUploadMsg(null); photoRef.current?.click(); }}
                  disabled={uploading || !granjaSeleccionada}
                  className="border-2 border-dashed border-gray-200 rounded-xl py-6 hover:border-gray-300 transition-colors disabled:opacity-50"
                >
                  <div className="flex flex-col items-center gap-2">
                    <CameraIcon className="h-7 w-7 text-gray-300" />
                    <span style={{ color: "#888780", fontSize: 13 }}>Foto</span>
                    <span style={{ color: "#aaa9a5", fontSize: 11 }}>Cámara · Galería</span>
                  </div>
                </button>
              </div>

              {uploading && (
                <p style={{ color: "#888780", fontSize: 12 }} className="mt-2 text-center">Subiendo…</p>
              )}
            </div>

            {uploadMsg && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{
                  backgroundColor: uploadMsg.ok ? "#ECFDF5" : "#FEF2F2",
                  color: uploadMsg.ok ? "#3B6D11" : "#A32D2D",
                }}
              >
                {uploadMsg.text}
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="lg:w-64">
            <div style={{ backgroundColor: "#f8f7f4", borderRadius: 8 }} className="p-4">
              <p style={{ fontWeight: 500, fontSize: 13 }} className="text-gray-800 mb-2">
                Formatos aceptados
              </p>
              <ul style={{ color: "#888780", fontSize: 12 }} className="space-y-1">
                <li>• PDF (.pdf)</li>
                <li>• Word (.doc, .docx)</li>
                <li>• PowerPoint (.ppt, .pptx)</li>
                <li>• Imágenes (jpg, png, heic…)</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p
                  style={{
                    color: "#888780",
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                  className="mb-1"
                >
                  Subido por
                </p>
                <p style={{ fontSize: 13 }} className="text-gray-700">{USUARIO_ACTUAL}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #e5e5e5" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800">
            Archivos{documentos.length > 0 ? ` (${documentos.length})` : ""}
          </h2>
          <select
            value={granjaFiltro}
            onChange={(e) => setGranjaFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="todas">Todas las granjas</option>
            {granjas.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: "#888780" }}>Cargando…</div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <DocumentIcon className="h-10 w-10 text-gray-200" />
            <p style={{ color: "#888780", fontSize: 13 }}>No hay archivos subidos todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Archivo</Th>
                  <Th>Granja</Th>
                  <Th>Categoría</Th>
                  <Th>Fecha</Th>
                  <Th>Tamaño</Th>
                  <Th>Subido por</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc) => (
                  <tr key={doc.id} className="border-t border-gray-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        {doc.tipo_archivo === "imagen" && doc.url_archivo ? (
                          <img
                            src={doc.url_archivo}
                            alt={doc.nombre}
                            className="h-8 w-8 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: TIPO_COLOR[doc.tipo_archivo],
                              backgroundColor: `${TIPO_COLOR[doc.tipo_archivo]}18`,
                              borderRadius: 4,
                            }}
                            className="px-1.5 py-0.5 uppercase tracking-wide flex-shrink-0"
                          >
                            {TIPO_LABEL[doc.tipo_archivo]}
                          </span>
                        )}
                        {doc.url_archivo ? (
                          <a
                            href={doc.url_archivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 13, color: "#374151" }}
                            className="hover:underline truncate max-w-xs"
                          >
                            {doc.nombre}
                          </a>
                        ) : (
                          <span style={{ fontSize: 13, color: "#374151" }} className="truncate max-w-xs">
                            {doc.nombre}
                          </span>
                        )}
                      </div>
                    </td>
                    <Td>{doc.granjas?.nombre ?? "—"}</Td>
                    <Td>{CAT_LABEL[doc.categoria]}</Td>
                    <Td>{fmtDate(doc.fecha_subida)}</Td>
                    <Td>{fmtSize(doc.tamano_bytes)}</Td>
                    <Td>{doc.subido_por}</Td>
                    <td className="py-3 pl-2">
                      {deleteConfirm === doc.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(doc)}
                            className="text-xs text-red-600 hover:underline font-medium"
                          >
                            Eliminar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs text-gray-400 hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(doc.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
