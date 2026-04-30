import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const BASE    = "https://opendata.aemet.es/opendata/api";
const STATION = "0370E";
const API_KEY = process.env.AEMET_API_KEY ?? "";

async function getWithData(label: string, url: string) {
  console.log(`\n── ${label}`);
  console.log("   URL:", url.replace(API_KEY, "***"));
  try {
    // Paso 1: metadata
    const r1 = await fetch(url);
    console.log("   HTTP:", r1.status);
    const meta = await r1.json() as { estado: number; datos?: string; descripcion?: string };
    console.log("   estado:", meta.estado, meta.descripcion ?? "");

    if (!meta.datos) { console.log("   (sin URL de datos)"); return; }

    // Paso 2: datos reales
    const r2 = await fetch(meta.datos);
    const body = await r2.text();
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { parsed = body.slice(0, 200); }

    if (Array.isArray(parsed)) {
      console.log(`   Registros: ${parsed.length}`);
      if (parsed.length > 0) console.log("   Primer registro:", JSON.stringify(parsed[0]).slice(0, 200));
    } else {
      console.log("   Body datos:", String(body).slice(0, 300));
    }
  } catch (e) {
    console.log("   ERROR:", e);
  }
}

async function main() {
  console.log("API key:", API_KEY ? `${API_KEY.slice(0, 20)}...` : "❌ VACÍA\n");

  // Rango largo — para ver hasta qué fecha llegan los datos
  await getWithData(
    "Marzo entero (1-31)",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-03-01T00:00:00UTC/fechafin/2026-03-31T00:00:00UTC/estacion/${STATION}?api_key=${API_KEY}`
  );

  await getWithData(
    "Abril 1-15",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-04-01T00:00:00UTC/fechafin/2026-04-15T00:00:00UTC/estacion/${STATION}?api_key=${API_KEY}`
  );

  await getWithData(
    "Abril 16-27",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-04-16T00:00:00UTC/fechafin/2026-04-27T00:00:00UTC/estacion/${STATION}?api_key=${API_KEY}`
  );

  await getWithData(
    "Solo ayer (2026-04-28)",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-04-28T00:00:00UTC/fechafin/2026-04-28T00:00:00UTC/estacion/${STATION}?api_key=${API_KEY}`
  );
}

main().catch(console.error);
