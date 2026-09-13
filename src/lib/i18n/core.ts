import en from "../../../locales/en.json";
import ua from "../../../locales/ua.json";

export const LOCALES = ["ua", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ua";
export const LANGUAGE_COOKIE = "zlata-language";
type Params = Record<string, string | number>;

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

function lookup(dictionary: unknown, key: string, count?: number, locale: Locale = "en"): string | undefined {
  let current: unknown = dictionary;
  for (const segment of key.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (current && typeof current === "object" && count !== undefined) {
    const forms = current as Record<string, string>;
    return forms[new Intl.PluralRules(localeTag(locale)).select(count)] ?? forms.other;
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(locale: Locale, key: string, params: Params = {}): string {
  const value = lookup(locale === "ua" ? ua : en, key, typeof params.count === "number" ? params.count : undefined, locale) ?? lookup(en, key, typeof params.count === "number" ? params.count : undefined, "en") ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function localeTag(locale: Locale) { return locale === "ua" ? "uk-UA" : "en-UA"; }
export function createTranslator(locale: Locale) { return (key: string, params?: Params) => translate(locale, key, params); }
