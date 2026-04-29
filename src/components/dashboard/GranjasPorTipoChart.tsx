"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TIPO_LABELS: Record<string, string> = {
  espina_de_pez: "Espina de Pez",
  paralela: "Paralela",
  rotativa: "Rotativa",
  tandem: "Tándem",
  robot: "Robot",
  otro: "Otro",
};

type Props = {
  data: { tipo: string; count: number }[];
};

export function GranjasPorTipoChart({ data }: Props) {
  const formatted = data.map((d) => ({
    nombre: TIPO_LABELS[d.tipo] ?? d.tipo,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" name="Granjas" fill="var(--accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
