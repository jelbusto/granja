"use client";

/*
  Supabase migration required — run in SQL editor:

  CREATE TABLE documentos (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT        NOT NULL,
    tipo_archivo  TEXT        NOT NULL CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint')),
    categoria     TEXT        NOT NULL CHECK (categoria IN ('informe_tecnico', 'otros')),
    fecha_subida  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subido_por    TEXT        NOT NULL DEFAULT 'Javier Heras',
    tamano_bytes  BIGINT,
    url_archivo   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  Also create a public Storage bucket named "documentos".
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DocumentIcon, TrashIcon } from "@/components/ui/Icons";

type TipoArchivo = "pdf" | "word" | "powerpoint";
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
};

const USUARIO_ACTUAL = "Javier Heras";
const ACCEPTED = ".pdf,.doc,.docx,.ppt,.pptx";

function detectTipo(file: File): TipoArchivo {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  return "powerpoint";
}

const TIPO_LABEL: Record<TipoArchivo, string> = { pdf: "PDF", word: "Word", powerpoint: "PowerPoint" };
const TIPO_COLOR: Record<TipoArchivo, string> = { pdf: "#DC2626", word: "#2563EB", powerpoint: "#D97706" };
const CAT_LABEL: Record<Categoria, string> = { informe_tecnico: "Informe Técnico", otros: "Otros" };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function DocumentacionPage() {
  const supabase = useRef(createClient()).current;
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("informe_tecnico");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocumentos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .order("fecha_subida", { ascending: false });
    if (!error) setDocumentos((data ?? []) as Documento[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadDocumentos();
  }, [loadDocumentos]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg(null);

    const tipo = detectTipo(file);
    const fileName = `${Date.now()}_${file.name}`;

    let url_archivo: string | null = null;
    const { data: storageData, error: storageError } = await supabase.storage
      .from("documentos")
      .upload(fileName, file, { contentType: file.type });

    if (!storageError && storageData) {
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(fileName);
      url_archivo = publicUrl;
    }

    const { error: dbError } = await supabase.from("documentos").insert({
      nombre: file.name,
      tipo_archivo: tipo,
      categoria,
      fecha_subida: new Date().toISOString(),
      subido_por: USUARIO_ACTUAL,
      tamano_bytes: file.size,
      url_archivo,
    } as never);

    if (dbError) {
      setUploadMsg({ ok: false, text: `Error al guardar: ${dbError.message}` });
    } else {
      setUploadMsg({ ok: true, text: `"${file.name}" subido correctamente.` });
      loadDocumentos();
    }

    setUploading(false);
    e.target.value = "";
  }

  async function handleDelete(doc: Documento) {
    if (doc.url_archivo) {
      const path = doc.url_archivo.split("/documentos/").pop();
      if (path) await supabase.storage.from("documentos").remove([path]);
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
        Repositorio de documentos relacionados con las granjas
      </p>

      {/* Upload card */}
      <div className="bg-white rounded-xl p-6 mb-6" style={{ border: "1px solid #e5e5e5" }}>
        <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800 mb-5">
          Subir documento
        </h2>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col gap-4 flex-1">
            {/* Category selector */}
            <div>
              <label
                style={{
                  color: "#888780",
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                className="block mb-1.5"
              >
                Categoría
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as Categoria)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="informe_tecnico">Informe Técnico</option>
                <option value="otros">Otros</option>
              </select>
            </div>

            {/* File drop zone */}
            <div>
              <label
                style={{
                  color: "#888780",
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                className="block mb-1.5"
              >
                Archivo
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                onChange={handleFile}
                className="hidden"
                disabled={uploading}
              />
              <button
                onClick={() => {
                  setUploadMsg(null);
                  fileRef.current?.click();
                }}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 text-center hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <div className="flex flex-col items-center gap-2">
                  <DocumentIcon className="h-8 w-8 text-gray-300" />
                  <span style={{ color: "#888780", fontSize: 13 }}>
                    {uploading ? "Subiendo…" : "Haz clic para seleccionar un archivo"}
                  </span>
                  <span style={{ color: "#aaa9a5", fontSize: 11 }}>PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx)</span>
                </div>
              </button>
            </div>

            {/* Result message */}
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
          <div className="lg:w-72">
            <div style={{ backgroundColor: "#f8f7f4", borderRadius: 8 }} className="p-4">
              <p style={{ fontWeight: 500, fontSize: 13 }} className="text-gray-800 mb-2">
                Formatos aceptados
              </p>
              <ul style={{ color: "#888780", fontSize: 12 }} className="space-y-1">
                <li>• PDF (.pdf)</li>
                <li>• Word (.doc, .docx)</li>
                <li>• PowerPoint (.ppt, .pptx)</li>
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
                <p style={{ fontSize: 13 }} className="text-gray-700">
                  {USUARIO_ACTUAL}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #e5e5e5" }}>
        <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800 mb-5">
          Documentos{documentos.length > 0 ? ` (${documentos.length})` : ""}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: "#888780" }}>
            Cargando…
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <DocumentIcon className="h-10 w-10 text-gray-200" />
            <p style={{ color: "#888780", fontSize: 13 }}>No hay documentos subidos todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Formato</Th>
                  <Th>Categoría</Th>
                  <Th>Fecha de subida</Th>
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
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: TIPO_COLOR[doc.tipo_archivo],
                            backgroundColor: `${TIPO_COLOR[doc.tipo_archivo]}18`,
                            borderRadius: 4,
                          }}
                          className="px-1.5 py-0.5 uppercase tracking-wide"
                        >
                          {TIPO_LABEL[doc.tipo_archivo]}
                        </span>
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
                    <Td>{TIPO_LABEL[doc.tipo_archivo]}</Td>
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
