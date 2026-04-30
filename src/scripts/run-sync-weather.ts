/**
 * Script standalone de sincronización meteorológica.
 *
 * Uso:
 *   npx tsx src/scripts/run-sync-weather.ts                        # sync diario (ayer)
 *   npx tsx src/scripts/run-sync-weather.ts --backfill              # desde 2026-01-01
 *   npx tsx src/scripts/run-sync-weather.ts --from=2026-02-01       # desde fecha hasta ayer
 *   npx tsx src/scripts/run-sync-weather.ts --from=2026-02-01 --to=2026-03-31
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { syncWeather, backfillWeather } from "@/jobs/sync-weather";

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.split("=")[1];
}

function yesterday(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const isBackfill = process.argv.includes("--backfill");
  const fromArg    = parseArg("from");
  const toArg      = parseArg("to");

  try {
    let result;

    if (isBackfill) {
      result = await backfillWeather();
    } else if (fromArg) {
      const fromDate = new Date(`${fromArg}T00:00:00Z`);
      const toDate   = toArg ? new Date(`${toArg}T00:00:00Z`) : yesterday();
      if (isNaN(fromDate.getTime())) throw new Error(`Fecha inválida: --from=${fromArg}`);
      if (isNaN(toDate.getTime()))   throw new Error(`Fecha inválida: --to=${toArg}`);
      result = await syncWeather({ fromDate, toDate });
    } else {
      result = await syncWeather();
    }

    process.exitCode = result.stations_error > 0 ? 1 : 0;
  } catch (err) {
    console.error("Error fatal en el job de sync:", err);
    process.exitCode = 1;
  }
}

main();
