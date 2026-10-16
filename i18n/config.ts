export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
/** Cookie that stores the visitor's choice. Kept out of the URL so share links never change. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * First visit without a saved choice: Vietnamese unless the browser's first
 * preferred language is something else (foreign clients get English).
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const first = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first || first.startsWith("vi")) return "vi";
  return "en";
}
