import { createClient } from "./server";
import type { Tables, TipoSalaEnum } from "@/types/database";

export type GranjaListRow = Pick<
  Tables<"granjas">,
  "id" | "codigo" | "nombre" | "pais" | "activo"
>;

export type GranjaWithSala = Tables<"granjas"> & {
  salas_ordeno: Tables<"salas_ordeno"> | null;
};

export type GranjaFormData = {
  id?: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  poblacion: string | null;
  provincia: string | null;
  pais: string | null;
  n_patios_lactacion: number | null;
  preparto: boolean;
  postparto: boolean;
  secas_descripcion: string | null;
  pct_eliminacion: number | null;
  dias_secado: number | null;
  activo: boolean;
  sala: {
    id?: string;
    marca: string | null;
    tipo: TipoSalaEnum;
    tipo_otro: string | null;
    n_puntos: number | null;
    vacas_hora: number | null;
    n_ordenadores: number | null;
    horas_ordeno: number | null;
  };
};

export type ActionResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

const PAGE_SIZE = 10;

export async function getGranjas(page = 1): Promise<{
  data: GranjaListRow[];
  count: number;
  pageSize: number;
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("granjas")
    .select("id, codigo, nombre, pais, activo", { count: "exact" })
    .order("nombre")
    .range(from, to);

  return {
    data: data ?? [],
    count: count ?? 0,
    pageSize: PAGE_SIZE,
    error: error ? { message: error.message } : null,
  };
}

export async function getGranja(id: string): Promise<{
  data: GranjaWithSala | null;
  error: { message: string } | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("granjas")
    .select("*, salas_ordeno (*)")
    .eq("id", id)
    .single();

  // La relación devuelve array — normalizamos a objeto único
  type RawRow = Tables<"granjas"> & {
    salas_ordeno: Tables<"salas_ordeno">[] | Tables<"salas_ordeno"> | null;
  };
  const row = data as unknown as RawRow | null;
  const normalized: GranjaWithSala | null = row
    ? {
        ...row,
        salas_ordeno: Array.isArray(row.salas_ordeno)
          ? (row.salas_ordeno[0] ?? null)
          : (row.salas_ordeno ?? null),
      }
    : null;

  return {
    data: normalized,
    error: error ? { message: error.message } : null,
  };
}

export async function saveGranja(formData: GranjaFormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { sala, ...granjaData } = formData;
  const now = new Date().toISOString();

  if (!granjaData.id) {
    // ── INSERT ────────────────────────────────────────────────────────────
    const { data: inserted, error: granjaErr } = await supabase
      .from("granjas")
      .insert({ ...granjaData, updated_at: now })
      .select("id")
      .single();

    if (granjaErr) return { data: null, error: { message: granjaErr.message } };

    const { error: salaErr } = await supabase
      .from("salas_ordeno")
      .insert({ ...sala, granja_id: inserted.id, updated_at: now });

    if (salaErr) {
      // Compensación manual: eliminar la granja recién creada
      await supabase.from("granjas").delete().eq("id", inserted.id);
      return { data: null, error: { message: salaErr.message } };
    }

    return { data: { id: inserted.id }, error: null };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────
  const { error: granjaErr } = await supabase
    .from("granjas")
    .update({ ...granjaData, updated_at: now })
    .eq("id", granjaData.id);

  if (granjaErr) return { data: null, error: { message: granjaErr.message } };

  if (sala.id) {
    const { error: salaErr } = await supabase
      .from("salas_ordeno")
      .update({ ...sala, updated_at: now })
      .eq("id", sala.id);
    if (salaErr) return { data: null, error: { message: salaErr.message } };
  } else {
    // Comprobar si ya existe sala para esta granja
    const { data: existing } = await supabase
      .from("salas_ordeno")
      .select("id")
      .eq("granja_id", granjaData.id)
      .maybeSingle();

    if (existing) {
      const { error: salaErr } = await supabase
        .from("salas_ordeno")
        .update({ ...sala, updated_at: now })
        .eq("id", existing.id);
      if (salaErr) return { data: null, error: { message: salaErr.message } };
    } else {
      const { error: salaErr } = await supabase
        .from("salas_ordeno")
        .insert({ ...sala, granja_id: granjaData.id, updated_at: now });
      if (salaErr) return { data: null, error: { message: salaErr.message } };
    }
  }

  return { data: { id: granjaData.id }, error: null };
}

export async function deleteGranja(id: string): Promise<{
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("granjas")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error ? { message: error.message } : null };
}
