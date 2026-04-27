"use server";

import { revalidatePath } from "next/cache";
import {
  saveGranja,
  deleteGranja,
  type GranjaFormData,
} from "@/lib/supabase/granjas";

export async function saveGranjaAction(data: GranjaFormData, locale: string) {
  const result = await saveGranja(data);
  if (result.error) return { error: result.error.message };
  revalidatePath(`/${locale}/granjas`);
  return { id: result.data?.id };
}

export async function deleteGranjaAction(id: string, locale: string) {
  const result = await deleteGranja(id);
  if (result.error) return { error: result.error.message };
  revalidatePath(`/${locale}/granjas`);
  return { success: true };
}
