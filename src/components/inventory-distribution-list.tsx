import { translate, type Locale } from "@/lib/i18n/core";
import { historicalLocationDisplayName } from "@/lib/locations/display";

type DistributionLocation = {
  id: string;
  name: string;
  location_type?: string | null;
  inStock: number;
  percentage: number;
};

export function InventoryDistributionList({ locations, locale }: { locations: DistributionLocation[]; locale: Locale }) {
  return <div className="mt-3">{locations.map(location => {
    const warehouse = location.location_type === "WAREHOUSE";
    return <div key={location.id} data-inventory-location={warehouse ? "warehouse" : "shop"} className={`border-t py-3 first:border-t-0 first:pt-0 last:pb-0 ${warehouse ? "mt-1 border-stone-300 pt-4 text-stone-600" : "border-stone-200"}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className={`truncate text-sm font-semibold ${warehouse ? "text-stone-700" : "text-stone-900"}`}>{historicalLocationDisplayName(location.name, locale)}</p>
        <span className={`zl-tabular shrink-0 text-sm font-medium ${warehouse ? "text-stone-600" : "text-amber-900"}`}>{Math.round(location.percentage)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className={`zl-inventory-progress h-full rounded-full ${warehouse ? "bg-stone-500/70" : "bg-amber-700/75"}`} style={{ width: `${Math.min(100, location.percentage)}%` }} />
      </div>
      <p className="zl-tabular mt-1.5 text-xs text-stone-600">{translate(locale, "dashboard.locationItems", { count: location.inStock })}</p>
    </div>;
  })}</div>;
}
