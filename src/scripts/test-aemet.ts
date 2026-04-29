import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const BASE    = "https://opendata.aemet.es/openapi/api";
const STATION = "0370E";
const API_KEY = process.env.AEMET_API_KEY ?? "";

async function get(label: string, url: string) {
  console.log(`\n── ${label}`);
  console.log("   URL:", url.replace(API_KEY, "***"));
  try {
    const r = await fetch(url);
    console.log("   HTTP:", r.status, r.statusText);
    const text = await r.text();
    console.log("   Body:", text.slice(0, 400));
  } catch (e) {
    console.log("   ERROR:", e);
  }
}

async function main() {
  console.log("API key:", API_KEY ? `${API_KEY.slice(0, 20)}...` : "❌ VACÍA\n");

  // 1. Endpoint de inventario de estaciones (el más simple, sin parámetros de fecha)
  await get(
    "Inventario de estaciones (sin fecha)",
    `${BASE}/valores/climatologicos/inventarioestaciones/todasestaciones/?api_key=${API_KEY}`
  );

  // 2. Climatología de hoy con formato date-only (sin hora)
  await get(
    "Diarios sin hora (YYYY-MM-DD)",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-04-01/fechafin/2026-04-27/estacion/${STATION}?api_key=${API_KEY}`
  );

  // 3. Formato estándar con hora
  await get(
    "Diarios con hora UTC",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-04-01T00:00:00UTC/fechafin/2026-04-27T00:00:00UTC/estacion/${STATION}?api_key=${API_KEY}`
  );

  // 4. Formato con trailing slash
  await get(
    "Diarios con trailing slash",
    `${BASE}/valores/climatologicos/diarios/datos/fechaini/2026-04-01T00%3A00%3A00UTC/fechafin/2026-04-27T00%3A00%3A00UTC/estacion/${STATION}/?api_key=${API_KEY}`
  );

  // 5. Observación convencional (endpoint alternativo)
  await get(
    "Observación convencional de la estación",
    `${BASE}/observacion/convencional/datos/estacion/${STATION}/?api_key=${API_KEY}`
  );
}

main().catch(console.error);
