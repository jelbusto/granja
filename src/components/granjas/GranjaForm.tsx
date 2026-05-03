"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { saveGranjaAction } from "@/lib/actions/granjas";
import type { GranjaWithSala, ObjetivosFormData } from "@/lib/supabase/granjas";
import type { TipoSalaEnum, WeatherStation } from "@/types/database";
import { PAISES, PROVINCIAS, type PaisCodigo } from "@/lib/geo/provinces";
import { createClient } from "@/lib/supabase/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toNullInt = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
};

const toNullFloat = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
};

const nullInt = z.preprocess(toNullInt, z.number().int().nonnegative().nullable());
const nullFloat = z.preprocess(toNullFloat, z.number().nonnegative().nullable());

// ─── Schema ───────────────────────────────────────────────────────────────────

const TIPOS_SALA = [
  "espina_de_pez",
  "paralela",
  "rotativa",
  "tandem",
  "robot",
  "otro",
] as const;

const schema = z
  .object({
    // Datos generales
    codigo: z.string().min(1),
    nombre: z.string().min(1),
    direccion: z.string().optional(),
    poblacion: z.string().optional(),
    provincia: z.string().optional(),
    pais: z.string().optional(),
    weather_station_id: z.string().optional(),
    // Objetivos
    obj_litros_vaca_dia: nullFloat,
    obj_calidad_mg_min:  nullFloat,
    obj_calidad_mp_min:  nullFloat,
    obj_calidad_ccs_max: nullFloat,
    obj_calidad_bact_max: nullFloat,
    obj_calidad_urea_min: nullFloat,
    obj_calidad_urea_max: nullFloat,
    // Datos del rebaño
    n_patios_lactacion: nullInt,
    preparto: z.boolean(),
    postparto: z.boolean(),
    secas_descripcion: z.string().optional(),
    pct_eliminacion: z.preprocess(
      toNullFloat,
      z.number().min(0).max(100).nullable()
    ),
    dias_secado: nullInt,
    // Sala de ordeño
    sala_marca: z.string().optional(),
    sala_tipo: z.enum(TIPOS_SALA),
    sala_tipo_otro: z.string().optional(),
    sala_n_puntos: nullInt,
    sala_vacas_hora: nullInt,
    sala_n_ordenadores: nullInt,
    sala_horas_ordeno: z.preprocess(
      toNullFloat,
      z.number().min(0).max(24).nullable()
    ),
  })
  .refine((d) => d.sala_tipo !== "otro" || !!d.sala_tipo_otro?.trim(), {
    path: ["sala_tipo_otro"],
    message: "required",
  });

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface GranjaFormProps {
  granja?: GranjaWithSala | null;
  weatherStations: WeatherStation[];
  objetivos?: ObjetivosFormData | null;
  locale: string;
}

// ─── Reusable field components ────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
      {children}
    </h2>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50";

const inputErrCls =
  "w-full rounded-md border border-red-400 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// ─── Component ────────────────────────────────────────────────────────────────

export function GranjaForm({ granja, weatherStations, objetivos, locale }: GranjaFormProps) {
  const tc = useTranslations("common");
  const t = useTranslations("granjas");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const sala = granja?.salas_ordeno ?? null;
  const str = (v: number | string | null | undefined) => (v == null ? "" : String(v));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: granja?.codigo ?? "",
      nombre: granja?.nombre ?? "",
      direccion: granja?.direccion ?? "",
      poblacion: granja?.poblacion ?? "",
      provincia: granja?.provincia ?? "",
      pais: granja?.pais ?? "",
      weather_station_id: granja?.weather_station_id ?? "",
      obj_litros_vaca_dia:  str(objetivos?.litros_vaca_dia)  as unknown as number | null,
      obj_calidad_mg_min:   str(objetivos?.calidad_mg_min)   as unknown as number | null,
      obj_calidad_mp_min:   str(objetivos?.calidad_mp_min)   as unknown as number | null,
      obj_calidad_ccs_max:  str(objetivos?.calidad_ccs_max)  as unknown as number | null,
      obj_calidad_bact_max: str(objetivos?.calidad_bact_max) as unknown as number | null,
      obj_calidad_urea_min: str(objetivos?.calidad_urea_min) as unknown as number | null,
      obj_calidad_urea_max: str(objetivos?.calidad_urea_max) as unknown as number | null,
      // Numeric fields: pass strings — z.preprocess converts them
      n_patios_lactacion: str(granja?.n_patios_lactacion) as unknown as number | null,
      preparto: granja?.preparto ?? false,
      postparto: granja?.postparto ?? false,
      secas_descripcion: granja?.secas_descripcion ?? "",
      pct_eliminacion: str(granja?.pct_eliminacion) as unknown as number | null,
      dias_secado: str(granja?.dias_secado) as unknown as number | null,
      sala_marca: sala?.marca ?? "",
      sala_tipo: (sala?.tipo ?? "espina_de_pez") as TipoSalaEnum,
      sala_tipo_otro: sala?.tipo_otro ?? "",
      sala_n_puntos: str(sala?.n_puntos) as unknown as number | null,
      sala_vacas_hora: str(sala?.vacas_hora) as unknown as number | null,
      sala_n_ordenadores: str(sala?.n_ordenadores) as unknown as number | null,
      sala_horas_ordeno: str(sala?.horas_ordeno) as unknown as number | null,
    },
  });

  const salaType = watch("sala_tipo");
  const paisValue = watch("pais") as PaisCodigo | "" | undefined;
  const provincias = paisValue && PROVINCIAS[paisValue as PaisCodigo] ? PROVINCIAS[paisValue as PaisCodigo] : null;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const result = await saveGranjaAction(
      {
        id: granja?.id,
        codigo: values.codigo,
        nombre: values.nombre,
        direccion: values.direccion?.trim() || null,
        poblacion: values.poblacion?.trim() || null,
        provincia: values.provincia?.trim() || null,
        pais: values.pais?.trim() || null,
        n_patios_lactacion: values.n_patios_lactacion,
        preparto: values.preparto,
        postparto: values.postparto,
        secas_descripcion: values.secas_descripcion?.trim() || null,
        pct_eliminacion: values.pct_eliminacion,
        dias_secado: values.dias_secado,
        weather_station_id: values.weather_station_id?.trim() || null,
        activo: granja?.activo ?? true,
        objetivos: {
          litros_vaca_dia:  values.obj_litros_vaca_dia,
          calidad_mg_min:   values.obj_calidad_mg_min,
          calidad_mp_min:   values.obj_calidad_mp_min,
          calidad_ccs_max:  values.obj_calidad_ccs_max,
          calidad_bact_max: values.obj_calidad_bact_max,
          calidad_urea_min: values.obj_calidad_urea_min,
          calidad_urea_max: values.obj_calidad_urea_max,
        },
        sala: {
          id: sala?.id,
          marca: values.sala_marca?.trim() || null,
          tipo: values.sala_tipo,
          tipo_otro: values.sala_tipo_otro?.trim() || null,
          n_puntos: values.sala_n_puntos,
          vacas_hora: values.sala_vacas_hora,
          n_ordenadores: values.sala_n_ordenadores,
          horas_ordeno: values.sala_horas_ordeno,
        },
      },
      locale
    );

    if (result.error) {
      setServerError(result.error);
      return;
    }

    const supabase = createClient();
    const address = [values.direccion, values.poblacion, values.provincia].filter(Boolean).join(", ");
    if (address && result.id) {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { "User-Agent": "DairyPro/1.0" } }
      )
        .then((r) => r.json())
        .then((data: { lat: string; lon: string }[]) => {
          if (data.length) {
            (
              supabase
                .from("granjas" as never)
                .update({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } as never)
                .eq("id", result.id!) as unknown as Promise<unknown>
            ).catch(() => {});
          }
        })
        .catch(() => {});
    }

    router.push("/granjas");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {tc("error")}: {serverError}
        </div>
      )}

      {/* ── Datos generales ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>{t("datos_generales")}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="codigo">{t("id")} *</Label>
            <input
              id="codigo"
              {...register("codigo")}
              className={errors.codigo ? inputErrCls : inputCls}
              placeholder="GRJ-001"
            />
            <FieldError message={errors.codigo && tc("required_field")} />
          </div>

          <div>
            <Label htmlFor="nombre">{t("nombre")} *</Label>
            <input
              id="nombre"
              {...register("nombre")}
              className={errors.nombre ? inputErrCls : inputCls}
            />
            <FieldError message={errors.nombre && tc("required_field")} />
          </div>

          <div>
            <Label htmlFor="direccion">{t("direccion")}</Label>
            <input id="direccion" {...register("direccion")} className={inputCls} />
          </div>

          <div>
            <Label htmlFor="poblacion">{t("poblacion")}</Label>
            <input id="poblacion" {...register("poblacion")} className={inputCls} />
          </div>

          <div>
            <Label htmlFor="pais">{t("pais")}</Label>
            <select
              id="pais"
              {...register("pais", {
                onChange: () => setValue("provincia", ""),
              })}
              className={inputCls}
            >
              <option value="">{t("pais_placeholder")}</option>
              {PAISES.map((code) => (
                <option key={code} value={code}>
                  {t(`paises.${code}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="provincia">{t("provincia")}</Label>
            {provincias ? (
              <select id="provincia" {...register("provincia")} className={inputCls}>
                <option value="">{t("provincia_placeholder")}</option>
                {provincias.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input id="provincia" {...register("provincia")} className={inputCls} />
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="weather_station_id">{t("estacion_meteorologica")}</Label>
            <select
              id="weather_station_id"
              {...register("weather_station_id")}
              className={inputCls}
            >
              <option value="">{t("estacion_placeholder")}</option>
              {weatherStations.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Datos del rebaño ────────────────────────────────────────────── */}
      <section>
        <SectionTitle>{t("datos_rebano")}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="n_patios_lactacion">{t("n_patios_lactacion")}</Label>
            <input
              id="n_patios_lactacion"
              type="number"
              min={0}
              {...register("n_patios_lactacion")}
              className={inputCls}
            />
            <FieldError message={errors.n_patios_lactacion?.message} />
          </div>

          <div>
            <Label htmlFor="pct_eliminacion">{t("pct_eliminacion")}</Label>
            <div className="relative">
              <input
                id="pct_eliminacion"
                type="number"
                min={0}
                max={100}
                step={0.1}
                {...register("pct_eliminacion")}
                className={inputCls + " pr-8"}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">
                %
              </span>
            </div>
            <FieldError message={errors.pct_eliminacion?.message} />
          </div>

          <div>
            <Label htmlFor="dias_secado">{t("dias_secado")}</Label>
            <input
              id="dias_secado"
              type="number"
              min={0}
              {...register("dias_secado")}
              className={inputCls}
            />
            <FieldError message={errors.dias_secado?.message} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="secas_descripcion">{t("secas_descripcion")}</Label>
            <textarea
              id="secas_descripcion"
              rows={2}
              {...register("secas_descripcion")}
              className={inputCls + " resize-none"}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                {...register("preparto")}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {t("preparto")}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                {...register("postparto")}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {t("postparto")}
            </label>
          </div>
        </div>
      </section>

      {/* ── Sala de ordeño ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle>{t("sala_ordeno")}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sala_marca">{t("marca")}</Label>
            <input id="sala_marca" {...register("sala_marca")} className={inputCls} />
          </div>

          <div>
            <Label htmlFor="sala_tipo">{t("tipo")}</Label>
            <select id="sala_tipo" {...register("sala_tipo")} className={inputCls}>
              {TIPOS_SALA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {t(`tipos.${tipo}`)}
                </option>
              ))}
            </select>
          </div>

          {salaType === "otro" && (
            <div className="sm:col-span-2">
              <Label htmlFor="sala_tipo_otro">{t("tipo_otro_label")} *</Label>
              <input
                id="sala_tipo_otro"
                {...register("sala_tipo_otro")}
                className={errors.sala_tipo_otro ? inputErrCls : inputCls}
              />
              <FieldError message={errors.sala_tipo_otro && tc("required_field")} />
            </div>
          )}

          <div>
            <Label htmlFor="sala_n_puntos">{t("n_puntos")}</Label>
            <input
              id="sala_n_puntos"
              type="number"
              min={0}
              {...register("sala_n_puntos")}
              className={inputCls}
            />
            <FieldError message={errors.sala_n_puntos?.message} />
          </div>

          <div>
            <Label htmlFor="sala_vacas_hora">{t("vacas_hora")}</Label>
            <input
              id="sala_vacas_hora"
              type="number"
              min={0}
              {...register("sala_vacas_hora")}
              className={inputCls}
            />
            <FieldError message={errors.sala_vacas_hora?.message} />
          </div>

          <div>
            <Label htmlFor="sala_n_ordenadores">{t("n_ordenadores")}</Label>
            <input
              id="sala_n_ordenadores"
              type="number"
              min={0}
              {...register("sala_n_ordenadores")}
              className={inputCls}
            />
            <FieldError message={errors.sala_n_ordenadores?.message} />
          </div>

          <div>
            <Label htmlFor="sala_horas_ordeno">{t("horas_ordeno")}</Label>
            <input
              id="sala_horas_ordeno"
              type="number"
              min={0}
              max={24}
              step={0.5}
              {...register("sala_horas_ordeno")}
              className={inputCls}
            />
            <FieldError message={errors.sala_horas_ordeno?.message} />
          </div>
        </div>
      </section>

      {/* ── Objetivos ───────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>{t("objetivos")}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>
            <Label htmlFor="obj_litros_vaca_dia">{t("obj_litros_vaca_dia")}</Label>
            <div className="relative">
              <input id="obj_litros_vaca_dia" type="number" min={0} step={0.1} {...register("obj_litros_vaca_dia")} className={inputCls + " pr-14"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">L/vaca</span>
            </div>
          </div>

          <div>
            <Label htmlFor="obj_calidad_mg_min">{t("obj_mg_min")}</Label>
            <div className="relative">
              <input id="obj_calidad_mg_min" type="number" min={0} step={0.01} {...register("obj_calidad_mg_min")} className={inputCls + " pr-8"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">%</span>
            </div>
          </div>

          <div>
            <Label htmlFor="obj_calidad_mp_min">{t("obj_mp_min")}</Label>
            <div className="relative">
              <input id="obj_calidad_mp_min" type="number" min={0} step={0.01} {...register("obj_calidad_mp_min")} className={inputCls + " pr-8"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">%</span>
            </div>
          </div>

          <div>
            <Label htmlFor="obj_calidad_ccs_max">{t("obj_ccs_max")}</Label>
            <div className="relative">
              <input id="obj_calidad_ccs_max" type="number" min={0} {...register("obj_calidad_ccs_max")} className={inputCls + " pr-16"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">mil/ml</span>
            </div>
          </div>

          <div>
            <Label htmlFor="obj_calidad_bact_max">{t("obj_bact_max")}</Label>
            <div className="relative">
              <input id="obj_calidad_bact_max" type="number" min={0} {...register("obj_calidad_bact_max")} className={inputCls + " pr-16"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">UFC/ml</span>
            </div>
          </div>

          <div>
            <Label htmlFor="obj_calidad_urea_min">{t("obj_urea_min")}</Label>
            <div className="relative">
              <input id="obj_calidad_urea_min" type="number" min={0} {...register("obj_calidad_urea_min")} className={inputCls + " pr-14"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">mg/L</span>
            </div>
          </div>

          <div>
            <Label htmlFor="obj_calidad_urea_max">{t("obj_urea_max")}</Label>
            <div className="relative">
              <input id="obj_calidad_urea_max" type="number" min={0} {...register("obj_calidad_urea_max")} className={inputCls + " pr-14"} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm">mg/L</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── Botones ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.push("/granjas")}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          {tc("cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? tc("loading") : tc("save")}
        </button>
      </div>
    </form>
  );
}
