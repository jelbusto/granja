type Props = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
};

export function KpiCard({ label, value, sub, icon }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <span className="text-3xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-sm text-gray-500">{sub}</span>}
    </div>
  );
}
