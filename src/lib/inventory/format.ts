import type { Locale } from "@/lib/i18n/core";
import { localeTag } from "@/lib/i18n/core";
export function formatPrice(value: number | null, locale: Locale = "ua") {
  if (value === null) return "—";
  return new Intl.NumberFormat(localeTag(locale), { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(value);
}
export function formatDate(value: string | null, locale: Locale = "ua") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function formatDateTime(value: string | null, locale: Locale = "ua") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

export function displayValue(value: string | number | null) {
  return value === null || value === "" ? "—" : String(value);
}
