/**
 * Script standalone de sincronización meteorológica.
 *
 * Uso:
 *   npx tsx src/scripts/run-sync-weather.ts           # sync diario (ayer)
 *   npx tsx src/scripts/run-sync-weather.ts --backfill # desde 2026-01-01
 *
 * Requiere las variables de entorno de .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AEMET_API_KEY
 */

// Carga .env.local automáticamente cuando no está en entorno Next.js
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { syncWeather, backfillWeather } from "@/jobs/sync-weather";

async function main() {
  const isBackfill = process.argv.includes("--backfill");

  try {
    const result = isBackfill
      ? await backfillWeather()
      : await syncWeather();

    process.exitCode = result.stations_error > 0 ? 1 : 0;
  } catch (err) {
    console.error("Error fatal en el job de sync:", err);
    process.exitCode = 1;
  }
}

main();
