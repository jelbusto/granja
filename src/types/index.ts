export type Locale = "es" | "en" | "pt";

export interface Granja {
  id: string;
  nombre: string;
  ubicacion: string;
  created_at: string;
  updated_at: string;
}

export interface Animal {
  id: string;
  granja_id: string;
  numero_identificacion: string;
  raza: string;
  fecha_nacimiento: string;
  activo: boolean;
  created_at: string;
}

export interface ProduccionLeche {
  id: string;
  animal_id: string;
  granja_id: string;
  fecha: string;
  litros_manana: number;
  litros_tarde: number;
  litros_total: number;
  created_at: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "veterinario" | "operador";
  granja_id: string | null;
  created_at: string;
}
