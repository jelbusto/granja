export const locales = ["es", "en", "pt"] as const;
export const defaultLocale = "es" as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};

// Namespaces de mensajes disponibles — añadir aquí al crear nuevos archivos JSON
export const namespaces = ["common", "granjas"] as const;
export type Namespace = (typeof namespaces)[number];
