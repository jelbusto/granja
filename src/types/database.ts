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
          id_granja: string;
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
          id_granja: string;
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
          id_granja?: string;
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
            foreignKeyName: "salas_ordeno_id_granja_fkey";
            columns: ["id_granja"];
            isOneToOne: true;
            referencedRelation: "granjas";
            referencedColumns: ["id"];
          }
        ];
      };
      registros_diarios: {
        Row: {
          id: string;
          id_granja: string;
          fecha: string;
          vacas_lactantes: number | null;
          vacas_secas: number | null;
          novillas: number | null;
          litros_tanque: number | null;
          litros_adicionales: number | null;
          calidad_mg: number | null;
          calidad_mp: number | null;
          calidad_bact: number | null;
          calidad_ccs: number | null;
          calidad_urea: number | null;
          temperatura_max: number | null;
          temperatura_min: number | null;
          humedad_max: number | null;
          humedad_min: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          id_granja: string;
          fecha: string;
          vacas_lactantes?: number | null;
          vacas_secas?: number | null;
          novillas?: number | null;
          litros_tanque?: number | null;
          litros_adicionales?: number | null;
          calidad_mg?: number | null;
          calidad_mp?: number | null;
          calidad_bact?: number | null;
          calidad_ccs?: number | null;
          calidad_urea?: number | null;
          temperatura_max?: number | null;
          temperatura_min?: number | null;
          humedad_max?: number | null;
          humedad_min?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["registros_diarios"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "registros_diarios_id_granja_fkey";
            columns: ["id_granja"];
            isOneToOne: false;
            referencedRelation: "granjas";
            referencedColumns: ["id"];
          }
        ];
      };
      user_granjas: {
        Row: {
          id: string;
          user_id: string;
          id_granja: string;
          rol: RolGranjaEnum;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          id_granja: string;
          rol: RolGranjaEnum;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          id_granja?: string;
          rol?: RolGranjaEnum;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_granjas_id_granja_fkey";
            columns: ["id_granja"];
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
    Views: {
      v_produccion_diaria: {
        Row: {
          fecha: string;
          id_granja: string;
          nombre_granja: string;
          vacas_lactantes: string | number | null;
          vacas_secas: string | number | null;
          novillas: string | number | null;
          litros_tanque: string | number | null;
          litros_adicionales: string | number | null;
          litros_totales: string | number | null;
          litros_por_vaca: string | number | null;
          calidad_mg: string | number | null;
          calidad_mp: string | number | null;
          calidad_bact: string | number | null;
          calidad_ccs: string | number | null;
          calidad_urea: string | number | null;
          temperatura_max: string | number | null;
          temperatura_min: string | number | null;
          humedad_max: string | number | null;
          humedad_min: string | number | null;
        };
      };
    };
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

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

// Tipos de conveniencia
export type Language = Tables<"languages">;
export type User = Tables<"users">;
export type Granja = Tables<"granjas">;
export type SalaOrdeno = Tables<"salas_ordeno">;
export type UserGranja = Tables<"user_granjas">;
export type ProduccionDiaria = Views<"v_produccion_diaria">;
