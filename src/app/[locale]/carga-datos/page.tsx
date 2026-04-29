"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

// ─── Column map: Excel header ↔ DB field ─────────────────────────────────────

const COLS = [
  { header: "Fecha",               field: "fecha",              example: "2024-01-15" },
  { header: "Vacas Lactantes",     field: "vacas_lactantes",    example: 120          },
  { header: "Vacas Secas",         field: "vacas_secas",        example: 18           },
  { header: "Novillas",            field: "novillas",           example: 12           },
  { header: "Litros Tanque",       field: "litros_tanque",      example: 3200         },
  { header: "Litros Adicionales",  field: "litros_adicionales", example: 0            },
  { header: "MG %",                field: "calidad_mg",         example: 3.85         },
  { header: "MP %",                field: "calidad_mp",         example: 3.20         },
  { header: "Bacteriología",       field: "calidad_bact",       example: 25           },
  { header: "CCS",                 field: "calidad_ccs",        example: 180          },
  { header: "Urea",                field: "calidad_urea",       example: 240          },
  { header: "Temp. Max",           field: "temperatura_max",    example: 28           },
  { header: "Temp. Min",           field: "temperatura_min",    example: 14           },
  { header: "Humedad Max",         field: "humedad_max",        example: 85           },
  { header: "Humedad Min",         field: "humedad_min",        example: 55           },
] as const;

type ColField = typeof COLS[number]["field"];
type RegistroRow = Record<ColField, unknown> & {
  id: string;
  id_granja: string;
  created_at: string;
  granjas?: { nombre: string } | null;
};
type ParsedRow = Record<ColField, string | number | null>;

const PAGE_SIZE = 100;
const TABLE     = "registros_diarios" as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function excelDateToISO(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(v ?? "");
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    COLS.map((c) => c.header),
    COLS.map((c) => c.example),
  ]);
  ws["!cols"] = COLS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, "plantilla_registros_diarios.xlsx");
}

function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array" });
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          wb.Sheets[wb.SheetNames[0]], { defval: null }
        );
        const rows: ParsedRow[] = raw.map((r) => {
          const row = {} as ParsedRow;
          for (const col of COLS) {
            const val = r[col.header] ?? null;
            (row as Record<string, unknown>)[col.field] =
              col.field === "fecha" ? excelDateToISO(val) : toNum(val);
          }
          return row;
        });
        resolve(rows.filter((r) => r.fecha));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function fmt(v: unknown, dec = 0): string {
  const n = Number(v);
  if (v === null || v === undefined || isNaN(n)) return "—";
  return n.toLocaleString("es", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`pb-2 font-medium whitespace-nowrap ${right ? "text-right px-3" : "text-left pr-3"}`}
      style={{ color: "#888780", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`py-2.5 whitespace-nowrap text-gray-700 ${right ? "text-right px-3" : "text-left pr-3"}`}
      style={{ fontSize: 13 }}>
      {children}
    </td>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CargaDatosPage() {
  const supabase = useRef(createClient()).current;

  const [granjas,      setGranjas]      = useState<{ id: string; nombre: string }[]>([]);
  const [granjaFiltro, setGranjaFiltro] = useState("todas");

  const [tableRows,    setTableRows]    = useState<RegistroRow[]>([]);
  const [page,         setPage]         = useState(0);
  const [total,        setTotal]        = useState(0);
  const [loadingTable, setLoadingTable] = useState(true);

  const [granjaUpload, setGranjaUpload] = useState("");
  const [parsed,       setParsed]       = useState<ParsedRow[] | null>(null);
  const [duplicates,   setDuplicates]   = useState<string[]>([]);
  const [confirmed,    setConfirmed]    = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [uploadMsg,    setUploadMsg]    = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load granjas
  useEffect(() => {
    supabase.from("granjas").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data }) => {
        const g = (data ?? []) as { id: string; nombre: string }[];
        setGranjas(g);
        if (g.length) setGranjaUpload(g[0].id);
      });
  }, [supabase]);

  // Load table
  const loadTable = useCallback(() => {
    setLoadingTable(true);
    const from = page * PAGE_SIZE;
    let q = supabase
      .from(TABLE)
      .select("*, granjas(nombre)", { count: "exact" })
      .order("fecha", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (granjaFiltro !== "todas") q = q.eq("id_granja", granjaFiltro);
    q.then(({ data, count }) => {
      setTableRows((data as RegistroRow[]) ?? []);
      setTotal(count ?? 0);
      setLoadingTable(false);
    });
  }, [supabase, page, granjaFiltro]);

  useEffect(() => { loadTable(); }, [loadTable]);
  useEffect(() => { setPage(0); }, [granjaFiltro]);

  // File selected → parse → check duplicates
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg(null);
    setParsed(null);
    setDuplicates([]);
    setConfirmed(false);

    try {
      const rows = await parseExcel(file);
      setParsed(rows);

      // Check which dates already exist for this granja
      const dates = rows.map((r) => String(r.fecha));
      const { data: existing } = await supabase
        .from(TABLE)
        .select("fecha")
        .eq("id_granja", granjaUpload)
        .in("fecha", dates);

      const dups = (existing ?? []).map((r) => String((r as { fecha: string }).fecha));
      setDuplicates(dups);
    } catch {
      setUploadMsg({ ok: false, text: "No se pudo leer el archivo. Comprueba que es un Excel válido." });
    }
    e.target.value = "";
  }

  // Confirm & upload
  async function handleUpload() {
    if (!parsed?.length || !granjaUpload) return;
    setUploading(true);
    setUploadMsg(null);

    const rows = parsed.map((r) => ({ ...r, id_granja: granjaUpload }));
    const { error } = await supabase.from(TABLE).upsert(rows as never[], {
      onConflict: "id_granja,fecha",
    });

    if (error) {
      setUploadMsg({ ok: false, text: `Error: ${error.message}` });
    } else {
      const replaced  = duplicates.length;
      const nuevos    = rows.length - replaced;
      const partes: string[] = [];
      if (nuevos   > 0) partes.push(`${nuevos} registros nuevos añadidos`);
      if (replaced > 0) partes.push(`${replaced} reemplazados`);
      setUploadMsg({ ok: true, text: partes.join(" · ") + "." });
      setParsed(null);
      setDuplicates([]);
      setConfirmed(false);
      loadTable();
    }
    setUploading(false);
  }

  const hasDuplicates  = duplicates.length > 0;
  const canUpload      = !!parsed?.length && (!hasDuplicates || confirmed);
  const totalPages     = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 bg-white min-h-screen max-w-7xl">
      <h1 style={{ fontWeight: 500, fontSize: 22 }} className="text-gray-900 mb-1">Datos diarios</h1>
      <p style={{ color: "#888780", fontSize: 13 }} className="mb-8">
        Visualización y carga de registros diarios de producción
      </p>

      {/* ── Upload card ── */}
      <div className="bg-white rounded-xl p-6 mb-6" style={{ border: "1px solid #e5e5e5" }}>
        <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800 mb-5">
          Cargar datos desde Excel
        </h2>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column */}
          <div className="flex flex-col gap-4 flex-1">

            {/* Granja selector */}
            <div>
              <label style={{ color: "#888780", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }} className="block mb-1.5">
                Granja destino
              </label>
              <select
                value={granjaUpload}
                onChange={(e) => { setGranjaUpload(e.target.value); setParsed(null); setDuplicates([]); setConfirmed(false); setUploadMsg(null); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {granjas.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <p style={{ color: "#888780", fontSize: 11 }} className="mt-1.5">
                Los datos se asignarán a esta granja. Si una fecha ya existe, el registro se reemplazará.
              </p>
            </div>

            {/* File picker */}
            <div>
              <label style={{ color: "#888780", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }} className="block mb-1.5">
                Archivo Excel
              </label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              <button
                onClick={() => { setParsed(null); setDuplicates([]); setConfirmed(false); setUploadMsg(null); fileRef.current?.click(); }}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-center hover:border-gray-300 transition-colors"
              >
                <span style={{ color: parsed ? "#374151" : "#888780", fontSize: 13, fontWeight: parsed ? 500 : 400 }}>
                  {parsed
                    ? `✓ ${parsed.length} filas leídas — haz clic para cambiar archivo`
                    : "Haz clic para seleccionar un archivo .xlsx"}
                </span>
              </button>
            </div>

            {/* Duplicates warning */}
            {hasDuplicates && (
              <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <p style={{ fontWeight: 500, fontSize: 13, color: "#92400E" }} className="mb-1">
                  {duplicates.length} {duplicates.length === 1 ? "registro ya existe" : "registros ya existen"} y se reemplazarán
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                  {duplicates.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                      {fmtDate(d)}
                    </span>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="rounded"
                  />
                  <span style={{ fontSize: 13, color: "#92400E" }}>
                    Entendido, quiero reemplazar estos registros
                  </span>
                </label>
              </div>
            )}

            {/* Upload button */}
            {parsed && (
              <button
                onClick={handleUpload}
                disabled={!canUpload || uploading}
                className="px-5 py-2.5 rounded-lg text-white text-sm transition-colors"
                style={{
                  backgroundColor: !canUpload || uploading ? "#d1d5db" : "var(--accent)",
                  fontWeight: 500,
                  cursor: !canUpload || uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading
                  ? "Cargando…"
                  : hasDuplicates && !confirmed
                  ? "Confirma el aviso para continuar"
                  : `Cargar ${parsed.length} registros`}
              </button>
            )}

            {/* Result message */}
            {uploadMsg && (
              <div className="rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: uploadMsg.ok ? "#ECFDF5" : "#FEF2F2", color: uploadMsg.ok ? "#3B6D11" : "#A32D2D" }}>
                {uploadMsg.text}
              </div>
            )}
          </div>

          {/* Right column: template + preview */}
          <div className="flex flex-col gap-3 lg:w-72">
            <div style={{ backgroundColor: "#f8f7f4", borderRadius: 8 }} className="p-4">
              <p style={{ fontWeight: 500, fontSize: 13 }} className="text-gray-800 mb-1">Plantilla Excel</p>
              <p style={{ color: "#888780", fontSize: 12 }} className="mb-3">
                Descarga la plantilla con las columnas exactas y rellena tus datos.
              </p>
              <button
                onClick={downloadTemplate}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 transition-colors"
                style={{ fontWeight: 500 }}
              >
                Descargar plantilla
              </button>
            </div>

            {parsed && parsed.length > 0 && (
              <div style={{ backgroundColor: "#f8f7f4", borderRadius: 8 }} className="p-4">
                <p style={{ color: "#888780", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }} className="mb-2">
                  Vista previa
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "#888780" }}>
                      <th className="text-left pb-1 pr-2">Fecha</th>
                      <th className="text-right pb-1 px-2">Vac. Lact.</th>
                      <th className="text-right pb-1 pl-2">L. Tanque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 4).map((r, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="py-1 pr-2 text-gray-700">{fmtDate(String(r.fecha))}</td>
                        <td className="py-1 px-2 text-right text-gray-700">{fmt(r.vacas_lactantes)}</td>
                        <td className="py-1 pl-2 text-right text-gray-700">{fmt(r.litros_tanque)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 4 && (
                  <p style={{ color: "#888780", fontSize: 11 }} className="mt-2">+{parsed.length - 4} filas más</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Data table ── */}
      <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #e5e5e5" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 style={{ fontWeight: 500, fontSize: 14 }} className="text-gray-800">Últimos registros cargados</h2>
          <div className="flex items-center gap-3">
            <select
              value={granjaFiltro}
              onChange={(e) => setGranjaFiltro(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="todas">Todas las granjas</option>
              {granjas.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <span style={{ color: "#888780", fontSize: 12 }}>
              {total > 0
                ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}`
                : "0 registros"}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >‹</button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >›</button>
            </div>
          </div>
        </div>

        {loadingTable ? (
          <div className="flex items-center justify-center h-40" style={{ color: "#888780" }}>Cargando…</div>
        ) : tableRows.length === 0 ? (
          <div className="flex items-center justify-center h-40" style={{ color: "#888780" }}>Sin registros</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Granja</Th>
                  <Th right>Vac. Lact.</Th>
                  <Th right>Vac. Secas</Th>
                  <Th right>Novillas</Th>
                  <Th right>L. Tanque</Th>
                  <Th right>L. Adic.</Th>
                  <Th right>MG %</Th>
                  <Th right>MP %</Th>
                  <Th right>CCS</Th>
                  <Th right>Bact.</Th>
                  <Th right>Urea</Th>
                  <Th right>T. Max</Th>
                  <Th right>T. Min</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <Td>{fmtDate(String(r.fecha))}</Td>
                    <Td>{r.granjas?.nombre ?? "—"}</Td>
                    <Td right>{fmt(r.vacas_lactantes)}</Td>
                    <Td right>{fmt(r.vacas_secas)}</Td>
                    <Td right>{fmt(r.novillas)}</Td>
                    <Td right>{fmt(r.litros_tanque)}</Td>
                    <Td right>{fmt(r.litros_adicionales)}</Td>
                    <Td right>{fmt(r.calidad_mg, 2)}</Td>
                    <Td right>{fmt(r.calidad_mp, 2)}</Td>
                    <Td right>{fmt(r.calidad_ccs)}</Td>
                    <Td right>{fmt(r.calidad_bact)}</Td>
                    <Td right>{fmt(r.calidad_urea)}</Td>
                    <Td right>{fmt(r.temperatura_max, 1)}</Td>
                    <Td right>{fmt(r.temperatura_min, 1)}</Td>
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
