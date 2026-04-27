import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("common");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">{t("active")}</p>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
      </div>
    </main>
  );
}
