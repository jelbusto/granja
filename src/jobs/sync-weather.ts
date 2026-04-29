import { createClient } from "@supabase/supabase-js";
import { fetchDailyWeather } from "@/lib/aemet";

// ─── DB client (service role — bypasa RLS) ────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Station = { id: string; code: string; name: string };

export type SyncResult = {
  stations_total: number;
  stations_ok: number;
  stations_error: number;
  rows_upserted: number;
  errors: { station: string; message: string }[];
  started_at: string;
  finished_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function yesterday(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysBefore(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function chunk<T>(
  items: T[],
  size: number,
  handler: (batch: T[]) => Promise<void>,
  delayMs = 1000
) {
  for (let i = 0; i < items.length; i += size) {
    await handler(items.slice(i, i + size));
    if (i + size < items.length) await sleep(delayMs);
  }
}

// ─── Job principal ────────────────────────────────────────────────────────────

export async function syncWeather(options?: {
  fromDate?: Date;   // para backfill histórico (ej: new Date("2026-01-01"))
  toDate?: Date;     // por defecto: ayer
}): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const db = getDb();

  const toDate   = options?.toDate   ?? yesterday();
  const fromDate = options?.fromDate ?? yesterday();

  console.log(`\n🌤  Sync meteorológico AEMET — ${isoDate(fromDate)} → ${isoDate(toDate)}`);

  // 1. Cargar estaciones activas
  const { data: stations, error: stErr } = await db
    .from("weather_stations")
    .select("id, code, name")
    .eq("active", true);

  if (stErr) throw new Error(`Error al cargar estaciones: ${stErr.message}`);

  const stationList = (stations ?? []) as Station[];
  console.log(`📡 ${stationList.length} estaciones activas\n`);

  const errors: { station: string; message: string }[] = [];
  let stationsOk = 0;
  let rowsUpserted = 0;

  // 2. Procesar en bloques de 3 con 1s de pausa entre bloques
  await chunk(stationList, 3, async (batch) => {
    await Promise.all(
      batch.map(async (station) => {
        try {
          console.log(`  ⬇  ${station.name} (${station.code}) — fetching...`);

          let readings = await fetchDailyWeather(station.code, fromDate, toDate);

          // Fallback: si no hay datos de ayer, intentar anteayer
          if (
            readings.length === 0 &&
            isoDate(fromDate) === isoDate(toDate) &&
            isoDate(toDate) === isoDate(yesterday())
          ) {
            console.log(`  ⚠  ${station.code} — sin datos de ayer, intentando anteayer...`);
            const dayBefore = daysBefore(2);
            readings = await fetchDailyWeather(station.code, dayBefore, dayBefore);
          }

          if (readings.length === 0) {
            console.log(`  ℹ  ${station.code} — sin datos disponibles`);
            stationsOk++;
            return;
          }

          // 3. Upsert en daily_weather_readings
          const rows = readings.map((r) => ({
            weather_station_id: station.id,
            ...r,
          }));

          const { error: upErr } = await db
            .from("daily_weather_readings")
            .upsert(rows, { onConflict: "weather_station_id,reading_date" });

          if (upErr) throw new Error(upErr.message);

          console.log(`  ✓  ${station.name} — ${rows.length} fila(s) upsertadas`);
          stationsOk++;
          rowsUpserted += rows.length;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ✗  ${station.name} (${station.code}) — ${msg}`);
          errors.push({ station: `${station.name} (${station.code})`, message: msg });
        }
      })
    );
  });

  const finishedAt = new Date().toISOString();

  const result: SyncResult = {
    stations_total:  stationList.length,
    stations_ok:     stationsOk,
    stations_error:  errors.length,
    rows_upserted:   rowsUpserted,
    errors,
    started_at:      startedAt,
    finished_at:     finishedAt,
  };

  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Completado: ${stationsOk}/${stationList.length} estaciones OK`);
  console.log(`   Filas upsertadas : ${rowsUpserted}`);
  if (errors.length) console.log(`   Errores         : ${errors.length}`);
  console.log("─────────────────────────────────────────\n");

  return result;
}

// ─── Modo backfill desde 2026-01-01 ──────────────────────────────────────────

export async function backfillWeather(): Promise<SyncResult> {
  return syncWeather({
    fromDate: new Date("2026-01-01T00:00:00Z"),
    toDate:   yesterday(),
  });
}
