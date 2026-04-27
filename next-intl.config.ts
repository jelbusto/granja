// Fuente de verdad de la configuración i18n.
// Importado por src/lib/i18n/config.ts — este archivo sirve como
// referencia rápida en la raíz del proyecto y para herramientas externas.

export const locales = ["es", "en", "pt"] as const;
export const defaultLocale = "es" as const;
export type Locale = (typeof locales)[number];

// Apunta al archivo de configuración de petición usado por next-intl/plugin
export const requestConfigPath = "./src/lib/i18n/request.ts";
