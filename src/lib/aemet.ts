// Cliente para la API OpenData de AEMET
// Docs: https://opendata.aemet.es/openapi/

const BASE = "https://opendata.aemet.es/openapi/api";

// ─── Tipos de respuesta AEMET ─────────────────────────────────────────────────

type AemetMeta = {
  estado: number;
  datos: string;
  descripcion?: string;
};

type AemetDailyRecord = {
  fecha: string;       // "2024-01-15"
  indicativo: string;  // código de estación
  tmin?: string;       // "4,5"  (°C)
  tmax?: string;
  tmed?: string;
  hrmin?: string;      // %
  hrmax?: string;
  hrmed?: string;
  prec?: string;       // mm  ("Ip" = inapreciable)
  velmedia?: string;   // m/s
  racha?: string;      // m/s
  presmax?: string;    // hPa
  presmed?: string;
};

// ─── Tipo de salida normalizado ───────────────────────────────────────────────

export type WeatherReading = {
  reading_date: string;
  temp_min_c: number | null;
  temp_max_c: number | null;
  temp_avg_c: number | null;
  humidity_min_pct: number | null;
  humidity_max_pct: number | null;
  humidity_avg_pct: number | null;
  precipitation_mm: number | null;
  wind_avg_kmh: number | null;
  wind_max_kmh: number | null;
  pressure_hpa: number | null;
  source: string;
  fetched_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: string | undefined): number | null {
  if (!v || v.trim() === "" || v.trim() === "Ip") return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function toAemetDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  // Los ":" del path deben ir URL-encoded como %3A
  return `${yyyy}-${mm}-${dd}T00%3A00%3A00UTC`;
}

// ─── Cliente ──────────────────────────────────────────────────────────────────

export async function fetchDailyWeather(
  stationCode: string,
  dateFrom: Date,
  dateTo: Date
): Promise<WeatherReading[]> {
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey) throw new Error("AEMET_API_KEY no está definida");

  // La API key va como query param; los ":" de las fechas van URL-encoded en el path
  const url =
    `${BASE}/valores/climatologicos/diarios/datos` +
    `/fechaini/${toAemetDate(dateFrom)}` +
    `/fechafin/${toAemetDate(dateTo)}` +
    `/estacion/${stationCode}` +
    `?api_key=${apiKey}`;

  // Paso 1: obtener la URL de datos
  const metaRes = await fetch(url);

  if (!metaRes.ok) {
    throw new Error(`AEMET HTTP ${metaRes.status} para estación ${stationCode}`);
  }

  const meta = (await metaRes.json()) as AemetMeta;

  if (meta.estado === 404) return []; // Sin datos para ese rango

  if (meta.estado !== 200 || !meta.datos) {
    throw new Error(
      `AEMET estado ${meta.estado}: ${meta.descripcion ?? "error desconocido"} (${stationCode})`
    );
  }

  // Paso 2: obtener el array de lecturas
  const dataRes = await fetch(meta.datos);
  if (!dataRes.ok) {
    throw new Error(`Error al descargar datos AEMET para ${stationCode}: HTTP ${dataRes.status}`);
  }

  const records = (await dataRes.json()) as AemetDailyRecord[];
  const fetchedAt = new Date().toISOString();

  return records.map((r): WeatherReading => {
    const velmedia = parseNum(r.velmedia);
    const racha    = parseNum(r.racha);
    return {
      reading_date:     r.fecha,
      temp_min_c:       parseNum(r.tmin),
      temp_max_c:       parseNum(r.tmax),
      temp_avg_c:       parseNum(r.tmed),
      humidity_min_pct: parseNum(r.hrmin),
      humidity_max_pct: parseNum(r.hrmax),
      humidity_avg_pct: parseNum(r.hrmed),
      precipitation_mm: parseNum(r.prec),
      wind_avg_kmh:     velmedia !== null ? Math.round(velmedia * 3.6 * 10) / 10 : null,
      wind_max_kmh:     racha    !== null ? Math.round(racha    * 3.6 * 10) / 10 : null,
      pressure_hpa:     parseNum(r.presmax ?? r.presmed),
      source:           "AEMET",
      fetched_at:       fetchedAt,
    };
  });
}
