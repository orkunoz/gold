import { createTranslator, type Locale } from "@/lib/i18n/core";

export function inventoryOrdinal(page: number, pageSize: number, index: number) {
  return (Math.max(1, page) - 1) * pageSize + index + 1;
}

export function inventoryResultSummary(page: number, pageSize: number, count: number, loaded: number, locale: Locale = "en") {
  const t = createTranslator(locale);
  if (count === 0 || loaded === 0) return t("inventory.productCount", { count: 0 });
  const first = (Math.max(1, page) - 1) * pageSize + 1;
  return t("inventory.showing", { count, range: loaded === 1 ? String(first) : `${first}–${first + Math.max(0, loaded - 1)}` });
}
