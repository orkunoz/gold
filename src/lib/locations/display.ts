import type { Locale } from "@/lib/i18n/core";

export type LocationDisplay = { name: string; location_type?: string | null };

const ukrainianLocationNames: Record<string, string> = {
  Warehouse: "Склад",
  Kamin: "Камінь",
  Horokhiv: "Горохів",
  Novovolynsk: "Нововолинськ",
  Volodymyr: "Володимир",
};

export function locationDisplayName(location: LocationDisplay | null | undefined, locale: Locale) {
  if (!location) return null;
  if (locale === "en") return location.name;
  if (location.location_type === "WAREHOUSE") return "Склад";
  return ukrainianLocationNames[location.name] ?? location.name;
}

export function historicalLocationDisplayName(name: string, locale: Locale) {
  return locale === "ua" ? ukrainianLocationNames[name] ?? name : name;
}
