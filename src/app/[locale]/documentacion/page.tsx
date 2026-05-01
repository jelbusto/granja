"use client";

// Web Speech API types (not in standard lib.dom.d.ts)
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
  interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
  interface SpeechRecognitionResultEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }
}

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
    storage_path  TEXT,
    id_granja     UUID        REFERENCES granjas(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  Storage bucket "documentos" (puede ser privado, se usan signed URLs).
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DocumentIcon, MicrophoneIcon, StopCircleIcon, TrashIcon } from "@/components/ui/Icons";

type TipoArchivo = "pdf" | "word" | "powerpoint" | "foto";
type Categoria = "informe_tecnico" | "otros";

type DocumentoRaw = {
  id: string;
  nombre: string;
  tipo_archivo: TipoArchivo;
  categoria: Categoria;
  fecha_subida: string;
  subido_por: string;
  tamano_bytes: number | null;
  storage_path: string | null;
  id_granja: string | null;
  granjas?: { nombre: string } | null;
};

type Documento = DocumentoRaw & { signedUrl: string | null };

const USUARIO_ACTUAL = "Javier Heras";

function detectTipo(file: File): TipoArchivo {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["ppt", "pptx"].includes(ext)) return "powerpoint";
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif", "webp"].includes(ext))
    return "foto";
  return "pdf";
}

// Handles both old records (full URL) and new ones (path)
function toStoragePath(urlOrPath: string): string {
  const match = urlOrPath.match(/\/object\/(?:public|sign)\/documentos\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : urlOrPath;
}

const TIPO_LABEL: Record<TipoArchivo, string> = { pdf: "PDF", word: "Word", powerpoint: "PPT", foto: "Foto" };
const TIPO_COLOR: Record<TipoArchivo, string> = {
  pdf: "#DC2626",
  word: "#2563EB",
  powerpoint: "#D97706",
  foto: "#059669",
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

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [transcripcion, setTranscripcion] = useState("");
  const [fechaVisita, setFechaVisita] = useState(() => new Date().toISOString().split("T")[0]);
  const [veterinario, setVeterinario] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [generando, setGenerando] = useState(false);
  const [informeGenerado, setInformeGenerado] = useState("");
  const [voiceMsg, setVoiceMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [subiendoInforme, setSubiendoInforme] = useState(false);
  const [notaExpandida, setNotaExpandida] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");

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

    if (error || !data) {
      setLoading(false);
      return;
    }

    const rows = data as DocumentoRaw[];

    // getPublicUrl is synchronous and works for public buckets (no auth needed)
    setDocumentos(
      rows.map((d) => {
        if (!d.storage_path) return { ...d, signedUrl: null };
        const path = toStoragePath(d.storage_path);
        const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);
        return { ...d, signedUrl: publicUrl };
      })
    );
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
    const nombre = tipo === "foto" ? `foto_${dateStr}` : file.name;
    const storagePath = `${granjaSeleccionada}/${Date.now()}_${file.name}`;

    const { error: storageError } = await supabase.storage
      .from("documentos")
      .upload(storagePath, file, { contentType: file.type });

    if (storageError) {
      setUploadMsg({ ok: false, text: `Error al subir el archivo: ${storageError.message}` });
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("documentos").insert({
      nombre,
      tipo_archivo: tipo,
      categoria,
      fecha_subida: now.toISOString(),
      subido_por: USUARIO_ACTUAL,
      tamano_bytes: file.size,
      storage_path: storagePath,
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
    if (doc.storage_path) {
      await supabase.storage.from("documentos").remove([toStoragePath(doc.storage_path)]);
    }
    const { error } = await supabase.from("documentos").delete().eq("id", doc.id);
    if (!error) setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleteConfirm(null);
  }

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SR) {
      setVoiceMsg({ ok: false, text: "Tu navegador no soporta reconocimiento de voz. Prueba Chrome o Edge." });
      return;
    }
    finalTranscriptRef.current = transcripcion;
    const recognition = new SR();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: SpeechRecognitionResultEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setTranscripcion(finalTranscriptRef.current + interim);
    };
    recognition.onerror = () => {
      setRecording(false);
      setVoiceMsg({ ok: false, text: "Error en el reconocimiento de voz." });
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  async function generarInforme() {
    if (!transcripcion.trim()) {
      setVoiceMsg({ ok: false, text: "Graba o escribe la transcripción primero." });
      return;
    }
    setGenerando(true);
    setVoiceMsg(null);
    const granjaNombre = granjas.find((g) => g.id === granjaSeleccionada)?.nombre ?? granjaSeleccionada;
    try {
      const res = await fetch("/api/generar-informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcripcion, granja: granjaNombre, fechaVisita, veterinario, observaciones }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try { msg += `: ${(JSON.parse(raw) as { error?: string }).error ?? raw}`; }
        catch { msg += raw ? `: ${raw.slice(0, 200)}` : ""; }
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setInformeGenerado(data.informe);
      setVoiceMsg({ ok: true, text: "Informe generado correctamente." });
    } catch (err) {
      setVoiceMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setGenerando(false);
  }

  async function buildDocx() {
    const {
      Document, Packer, Paragraph, TextRun, ImageRun,
      HeadingLevel, AlignmentType,
    } = await import("docx");

    let logoData: ArrayBuffer | null = null;
    try {
      const r = await fetch("/logo.png");
      logoData = await r.arrayBuffer();
    } catch { /* logo optional */ }

    const children: InstanceType<typeof Paragraph>[] = [];

    if (logoData) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: logoData,
              transformation: { width: 160, height: 64 },
              type: "png",
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
      children.push(new Paragraph({ text: "" }));
    }

    children.push(
      new Paragraph({
        text: "INFORME DE VISITA VETERINARIA",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );
    children.push(new Paragraph({ text: "" }));

    const granjaNombre = granjas.find((g) => g.id === granjaSeleccionada)?.nombre ?? granjaSeleccionada;
    const meta = [
      `Granja: ${granjaNombre}`,
      `Fecha de visita: ${fechaVisita}`,
      `Veterinario: ${veterinario || "—"}`,
    ];
    for (const m of meta) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: m, bold: true, size: 22 })],
        })
      );
    }
    children.push(new Paragraph({ text: "" }));

    for (const line of informeGenerado.split("\n")) {
      if (line.trim() === "") {
        children.push(new Paragraph({ text: "" }));
      } else if (/^\d+\.\s+[A-ZÁÉÍÓÚÑ]/.test(line.trim())) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.trim(), bold: true, size: 24 })],
            spacing: { before: 240 },
          })
        );
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })] }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    return { blob: await Packer.toBlob(doc), nombre: `informe_veterinario_${granjaNombre}_${fechaVisita}` };
  }

  async function descargarWord() {
    const result = await buildDocx();
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.nombre}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function subirAlRepositorio() {
    if (!informeGenerado || !granjaSeleccionada) return;
    setSubiendoInforme(true);
    setVoiceMsg(null);
    try {
      const result = await buildDocx();
      if (!result) throw new Error("No se pudo generar el documento.");
      const storagePath = `${granjaSeleccionada}/${Date.now()}_${result.nombre}.docx`;
      const { error: storageError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, result.blob, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      if (storageError) throw new Error(storageError.message);
      const { error: dbError } = await supabase.from("documentos").insert({
        nombre: result.nombre,
        tipo_archivo: "word",
        categoria: "informe_tecnico",
        fecha_subida: new Date().toISOString(),
        subido_por: USUARIO_ACTUAL,
        tamano_bytes: result.blob.size,
        storage_path: storagePath,
        id_granja: granjaSeleccionada,
      } as never);
      if (dbError) throw new Error(dbError.message);
      setVoiceMsg({ ok: true, text: `"${result.nombre}" guardado en el repositorio.` });
      loadDocumentos();
    } catch (err) {
      setVoiceMsg({ ok: false, text: `Error al subir: ${err instanceof Error ? err.message : String(err)}` });
    }
    setSubiendoInforme(false);
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
        {/* Granja */}
        <div className="mb-5">
          <FieldLabel>Granja</FieldLabel>
          <select
            value={granjaSeleccionada}
            onChange={(e) => setGranjaSeleccionada(e.target.value)}
            className="w-full sm:w-72 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {granjas.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={handleFileInput} className="hidden" disabled={uploading} />
        <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" disabled={uploading} />

        {/* 3 options */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => { setUploadMsg(null); setNotaExpandida(false); fileRef.current?.click(); }}
            disabled={uploading || !granjaSeleccionada}
            className="border border-gray-200 rounded-xl py-5 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <div className="flex flex-col items-center gap-2">
              <DocumentIcon className="h-6 w-6 text-gray-400" />
              <span style={{ color: "#374151", fontSize: 13, fontWeight: 500 }}>Documento</span>
              <span style={{ color: "#aaa9a5", fontSize: 11 }}>PDF · Word · PPT</span>
            </div>
          </button>

          <button
            onClick={() => { setUploadMsg(null); setNotaExpandida(false); photoRef.current?.click(); }}
            disabled={uploading || !granjaSeleccionada}
            className="border border-gray-200 rounded-xl py-5 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <div className="flex flex-col items-center gap-2">
              <CameraIcon className="h-6 w-6 text-gray-400" />
              <span style={{ color: "#374151", fontSize: 13, fontWeight: 500 }}>Foto</span>
              <span style={{ color: "#aaa9a5", fontSize: 11 }}>Cámara · Galería</span>
            </div>
          </button>

          <button
            onClick={() => { setVoiceMsg(null); setNotaExpandida((v) => !v); }}
            disabled={uploading || !granjaSeleccionada}
            className="border rounded-xl py-5 transition-colors disabled:opacity-50"
            style={
              notaExpandida
                ? { borderColor: "var(--accent)", backgroundColor: "#f5f3ff" }
                : { borderColor: "#e5e5e5" }
            }
          >
            <div className="flex flex-col items-center gap-2">
              <MicrophoneIcon
                className="h-6 w-6"
                style={{ color: notaExpandida ? "var(--accent)" : "#9ca3af" }}
              />
              <span style={{ color: notaExpandida ? "var(--accent)" : "#374151", fontSize: 13, fontWeight: 500 }}>
                Nota de voz
              </span>
              <span style={{ color: "#aaa9a5", fontSize: 11 }}>Informe veterinario</span>
            </div>
          </button>
        </div>

        {/* Upload feedback */}
        {uploading && (
          <p style={{ color: "#888780", fontSize: 12 }} className="mt-4 text-center">Subiendo…</p>
        )}
        {uploadMsg && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: uploadMsg.ok ? "#ECFDF5" : "#FEF2F2",
              color: uploadMsg.ok ? "#3B6D11" : "#A32D2D",
            }}
          >
            {uploadMsg.text}
          </div>
        )}

        {/* Nota de voz — expanded */}
        {notaExpandida && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left: form + recording */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Fecha de visita</FieldLabel>
                    <input
                      type="date"
                      value={fechaVisita}
                      onChange={(e) => setFechaVisita(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <FieldLabel>Veterinario</FieldLabel>
                    <input
                      type="text"
                      value={veterinario}
                      onChange={(e) => setVeterinario(e.target.value)}
                      placeholder="Nombre del veterinario"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Observaciones adicionales</FieldLabel>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas adicionales que no quieres dictar…"
                    rows={2}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FieldLabel>Transcripción</FieldLabel>
                    <button
                      onClick={toggleRecording}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                      style={
                        recording
                          ? { backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }
                          : { backgroundColor: "var(--accent)", color: "#fff", border: "none" }
                      }
                    >
                      {recording ? (
                        <><StopCircleIcon className="h-4 w-4" /> Detener</>
                      ) : (
                        <><MicrophoneIcon className="h-4 w-4" /> Grabar</>
                      )}
                    </button>
                  </div>
                  {recording && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: "#DC2626" }} />
                      <span style={{ color: "#DC2626", fontSize: 12 }}>Grabando…</span>
                    </div>
                  )}
                  <textarea
                    value={transcripcion}
                    onChange={(e) => {
                      setTranscripcion(e.target.value);
                      finalTranscriptRef.current = e.target.value;
                    }}
                    placeholder="La transcripción aparecerá aquí mientras hablas, o puedes escribirla directamente…"
                    rows={5}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={generarInforme}
                    disabled={generando || !transcripcion.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {generando ? "Generando…" : "Generar con IA"}
                  </button>
                  {informeGenerado && (
                    <>
                      <button
                        onClick={descargarWord}
                        className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
                      >
                        Descargar Word
                      </button>
                      <button
                        onClick={subirAlRepositorio}
                        disabled={subiendoInforme}
                        className="px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}
                      >
                        {subiendoInforme ? "Subiendo…" : "Subir al repositorio"}
                      </button>
                    </>
                  )}
                </div>

                {voiceMsg && (
                  <div
                    className="rounded-lg px-4 py-3 text-sm"
                    style={{
                      backgroundColor: voiceMsg.ok ? "#ECFDF5" : "#FEF2F2",
                      color: voiceMsg.ok ? "#3B6D11" : "#A32D2D",
                    }}
                  >
                    {voiceMsg.text}
                  </div>
                )}
              </div>

              {/* Right: preview */}
              <div className="lg:w-80">
                <FieldLabel>Vista previa del informe</FieldLabel>
                <div
                  className="rounded-xl p-4 overflow-y-auto"
                  style={{
                    backgroundColor: "#f8f7f4",
                    border: "1px solid #e5e5e5",
                    minHeight: 200,
                    maxHeight: 420,
                    fontSize: 12,
                    color: "#374151",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                  }}
                >
                  {informeGenerado || (
                    <span style={{ color: "#aaa9a5" }}>El informe formateado aparecerá aquí…</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail for images */}
                        {doc.tipo_archivo === "foto" ? (
                          doc.signedUrl ? (
                            <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <img
                                src={doc.signedUrl}
                                alt={doc.nombre}
                                className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                                style={{ border: "1px solid #e5e5e5" }}
                              />
                            </a>
                          ) : (
                            <div
                              className="h-12 w-12 rounded-lg flex-shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e5e5" }}
                            >
                              <CameraIcon className="h-5 w-5 text-gray-300" />
                            </div>
                          )
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
                        {doc.signedUrl ? (
                          <a
                            href={doc.signedUrl}
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
                    <td className="py-2 pl-2">
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
