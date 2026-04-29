import { createClient } from "./server";

export type DashboardStats = {
  totalGranjas: number;
  granjasActivas: number;
  totalSalas: number;
  mediaVacasHora: number | null;
  porTipoSala: { tipo: string; count: number }[];
  porPais: { pais: string; count: number }[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [granjasRes, salasRes] = await Promise.all([
    supabase.from("granjas").select("id, activo, pais"),
    supabase.from("salas_ordeno").select("tipo, vacas_hora"),
  ]);

  const granjas = granjasRes.data ?? [];
  const salas = salasRes.data ?? [];

  const totalGranjas = granjas.length;
  const granjasActivas = granjas.filter((g) => g.activo).length;
  const totalSalas = salas.length;

  const vacasHoraValues = salas
    .map((s) => s.vacas_hora)
    .filter((v): v is number => v !== null);
  const mediaVacasHora = vacasHoraValues.length
    ? Math.round(vacasHoraValues.reduce((a, b) => a + b, 0) / vacasHoraValues.length)
    : null;

  const tipoMap: Record<string, number> = {};
  for (const s of salas) {
    tipoMap[s.tipo] = (tipoMap[s.tipo] ?? 0) + 1;
  }
  const porTipoSala = Object.entries(tipoMap)
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count);

  const paisMap: Record<string, number> = {};
  for (const g of granjas) {
    const pais = g.pais ?? "Sin especificar";
    paisMap[pais] = (paisMap[pais] ?? 0) + 1;
  }
  const porPais = Object.entries(paisMap)
    .map(([pais, count]) => ({ pais, count }))
    .sort((a, b) => b.count - a.count);

  return { totalGranjas, granjasActivas, totalSalas, mediaVacasHora, porTipoSala, porPais };
}
