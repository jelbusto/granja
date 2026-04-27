import { useTranslations } from "next-intl";

export default function AuthPage() {
  const t = useTranslations("common");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">{t("app_name")}</h1>
      </div>
    </main>
  );
}
