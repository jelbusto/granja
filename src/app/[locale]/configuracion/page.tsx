"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { locales, localeNames } from "@/lib/i18n/config";
import { useTheme } from "@/components/providers/ThemeProvider";
import { THEMES, THEME_HEX, type Theme } from "@/lib/theme";

export default function ConfiguracionPage() {
  const t = useTranslations("configuracion");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-800 mb-8">{t("titulo")}</h1>

      {/* Language */}
      <section className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {t("idioma_titulo")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => router.replace(pathname, { locale: loc })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                locale === loc
                  ? "border-accent bg-accent text-white"
                  : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white"
              }`}
            >
              {localeNames[loc]}
            </button>
          ))}
        </div>
      </section>

      {/* Color theme */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {t("tema_titulo")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((th) => (
            <button
              key={th}
              onClick={() => setTheme(th)}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                theme === th
                  ? "border-accent shadow-md"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <span
                className="h-5 w-5 rounded-full flex-shrink-0 ring-2 ring-white ring-offset-1"
                style={{ backgroundColor: THEME_HEX[th], ringOffsetColor: THEME_HEX[th] }}
              />
              <span className="text-gray-800">
                {t(`tema_${th}` as `tema_${Theme}`)}
              </span>
              {theme === th && (
                <span className="ml-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
