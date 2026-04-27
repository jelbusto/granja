export type TipoSalaEnum =
  | "espina_de_pez"
  | "paralela"
  | "rotativa"
  | "tandem"
  | "robot"
  | "otro";

export type RolGranjaEnum =
  | "propietario"
  | "veterinario"
  | "tecnico"
  | "solo_lectura";

export type Database = {
  public: {
    Tables: {
      languages: {
        Row: {
          code: string;
          nombre: string;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          nombre: string;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          nombre?: string;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          password_hash: string | null;
          locale: string;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          password_hash?: string | null;
          locale?: string;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          password_hash?: string | null;
          locale?: string;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      granjas: {
        Row: {
          id: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          direccion?: string | null;
          poblacion?: string | null;
          provincia?: string | null;
          pais?: string | null;
          n_patios_lactacion?: number | null;
          preparto?: boolean;
          postparto?: boolean;
          secas_descripcion?: string | null;
          pct_eliminacion?: number | null;
          dias_secado?: number | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nombre?: string;
          direccion?: string | null;
          poblacion?: string | null;
          provincia?: string | null;
          pais?: string | null;
          n_patios_lactacion?: number | null;
          preparto?: boolean;
          postparto?: boolean;
          secas_descripcion?: string | null;
          pct_eliminacion?: number | null;
          dias_secado?: number | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salas_ordeno: {
        Row: {
          id: string;
          granja_id: string;
          marca: string | null;
          tipo: TipoSalaEnum;
          tipo_otro: string | null;
          n_puntos: number | null;
          vacas_hora: number | null;
          n_ordenadores: number | null;
          horas_ordeno: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          granja_id: string;
          marca?: string | null;
          tipo: TipoSalaEnum;
          tipo_otro?: string | null;
          n_puntos?: number | null;
          vacas_hora?: number | null;
          n_ordenadores?: number | null;
          horas_ordeno?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          granja_id?: string;
          marca?: string | null;
          tipo?: TipoSalaEnum;
          tipo_otro?: string | null;
          n_puntos?: number | null;
          vacas_hora?: number | null;
          n_ordenadores?: number | null;
          horas_ordeno?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "salas_ordeno_granja_id_fkey";
            columns: ["granja_id"];
            isOneToOne: true;
            referencedRelation: "granjas";
            referencedColumns: ["id"];
          }
        ];
      };
      user_granjas: {
        Row: {
          id: string;
          user_id: string;
          granja_id: string;
          rol: RolGranjaEnum;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          granja_id: string;
          rol: RolGranjaEnum;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          granja_id?: string;
          rol?: RolGranjaEnum;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_granjas_granja_id_fkey";
            columns: ["granja_id"];
            isOneToOne: false;
            referencedRelation: "granjas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_granjas_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      tipo_sala_enum: TipoSalaEnum;
      rol_granja_enum: RolGranjaEnum;
    };
  };
};

// Helpers para extraer tipos de fila directamente
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Tipos de conveniencia
export type Language = Tables<"languages">;
export type User = Tables<"users">;
export type Granja = Tables<"granjas">;
export type SalaOrdeno = Tables<"salas_ordeno">;
export type UserGranja = Tables<"user_granjas">;
