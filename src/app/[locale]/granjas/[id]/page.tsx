import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGranja, getWeatherStations, getObjetivos } from "@/lib/supabase/granjas";
import { GranjaForm } from "@/components/granjas/GranjaForm";
import { Link } from "@/lib/i18n/routing";

interface PageProps {
  params: { id: string; locale: string };
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations({ locale: params.locale, namespace: "granjas" });
  return {
    title: params.id === "new" ? t("new_granja") : t("edit_granja"),
  };
}

export default async function GranjaPage({ params }: PageProps) {
  const { id, locale } = params;
  const t = await getTranslations({ locale, namespace: "granjas" });

  let granja = null;
  let objetivos = null;

  const weatherStations = await getWeatherStations();

  if (id !== "new") {
    const [granjaResult, objResult] = await Promise.all([
      getGranja(id),
      getObjetivos(id),
    ]);
    if (granjaResult.error || !granjaResult.data) notFound();
    granja    = granjaResult.data;
    objetivos = objResult;
  }

  const title = id === "new" ? t("new_granja") : t("edit_granja");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/granjas" className="hover:text-gray-700 transition-colors">
            {t("title")}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{title}</span>
        </nav>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">{title}</h1>
          <GranjaForm granja={granja} weatherStations={weatherStations} objetivos={objetivos} locale={locale} />
        </div>
      </div>
    </div>
  );
}
