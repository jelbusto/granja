import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { locales, defaultLocale, namespaces } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as (typeof locales)[number])) {
    locale = defaultLocale;
  }

  const messages: Record<string, AbstractIntlMessages> = {};
  for (const ns of namespaces) {
    messages[ns] = (
      await import(`../../../locales/${locale}/${ns}.json`)
    ).default;
  }

  return { locale, messages };
});
