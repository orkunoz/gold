import type { Locale } from "@/lib/i18n/core";
import { historicalLocationDisplayName } from "@/lib/locations/display";

export type InventoryLocation = { id: string; name: string; code?: string | null; location_type?: string | null; is_active: boolean };
export type InventoryLocationCount = { shop_id: string; in_stock_count: number };

export function inventoryDistribution(locations: InventoryLocation[], counts: InventoryLocationCount[], locale: Locale = "en") {
  const countByLocation = new Map(counts.map(row => [row.shop_id, Number(row.in_stock_count) || 0]));
  const active = locations.filter(location => location.is_active).map(location => ({
    id: location.id,
    name: location.name,
    code: location.code ?? null,
    location_type: location.location_type ?? null,
    inStock: countByLocation.get(location.id) ?? 0,
  }));
  const totalInStock = active.reduce((total, location) => total + location.inStock, 0);
  const distribution = active.map(location => ({
    ...location,
    totalInStock,
    percentage: totalInStock > 0 ? location.inStock / totalInStock * 100 : 0,
  }));
  const collator = new Intl.Collator(locale === "ua" ? "uk-UA" : "en-UA", { sensitivity: "base" });
  const byStockThenName = (left: typeof distribution[number], right: typeof distribution[number]) =>
    right.inStock - left.inStock || collator.compare(historicalLocationDisplayName(left.name, locale), historicalLocationDisplayName(right.name, locale)) || left.id.localeCompare(right.id);
  return [
    ...distribution.filter(location => location.location_type !== "WAREHOUSE").sort(byStockThenName),
    ...distribution.filter(location => location.location_type === "WAREHOUSE").sort(byStockThenName),
  ];
}
