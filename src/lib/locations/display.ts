import type { Locale } from "@/lib/i18n/core";

export type LocationDisplay = { name: string; location_type?: string | null };

export function locationDisplayName(location: LocationDisplay | null | undefined, locale: Locale) {
  if (!location) return null;
  return location.location_type === "WAREHOUSE" ? (locale === "ua" ? "Склад" : "Warehouse") : location.name;
}

export function historicalLocationDisplayName(name: string, locale: Locale) {
  return name === "Warehouse" ? (locale === "ua" ? "Склад" : "Warehouse") : name;
}
