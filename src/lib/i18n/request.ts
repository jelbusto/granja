import { getRequestConfig } from "next-intl/server";
import { locales, defaultLocale, namespaces } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as (typeof locales)[number])) {
    locale = defaultLocale;
  }

  // Carga todos los namespaces y los agrupa bajo su clave
  const messages: Record<string, unknown> = {};
  for (const ns of namespaces) {
    messages[ns] = (
      await import(`../../../locales/${locale}/${ns}.json`)
    ).default;
  }

  return { locale, messages };
});
