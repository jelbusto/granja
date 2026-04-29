import { NextRequest, NextResponse } from "next/server";
import { syncWeather, backfillWeather } from "@/jobs/sync-weather";

export const runtime = "nodejs";
// Timeout generoso: con muchas estaciones y backfill puede tardar varios minutos
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET no configurado" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return unauthorized();

  // ── Parámetros opcionales ────────────────────────────────────────────────────
  // ?backfill=true  → carga histórica desde 2026-01-01
  // ?from=YYYY-MM-DD&to=YYYY-MM-DD → rango personalizado
  const { searchParams } = new URL(req.url);
  const isBackfill = searchParams.get("backfill") === "true";
  const fromParam  = searchParams.get("from");
  const toParam    = searchParams.get("to");

  try {
    const result = isBackfill
      ? await backfillWeather()
      : await syncWeather({
          fromDate: fromParam ? new Date(`${fromParam}T00:00:00Z`) : undefined,
          toDate:   toParam   ? new Date(`${toParam}T00:00:00Z`)   : undefined,
        });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-weather] Error fatal:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron llama con GET; redirigimos a POST internamente
export async function GET(req: NextRequest) {
  return POST(req);
}
