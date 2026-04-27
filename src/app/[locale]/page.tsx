import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";

export default function HomePage() {
  const t = useTranslations("common");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">{t("app_name")}</h1>
      <Link
        href="/dashboard"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Dashboard →
      </Link>
    </main>
  );
}
