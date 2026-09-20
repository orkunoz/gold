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
  return <div className="mt-2 grid gap-1 sm:grid-cols-2">{locations.map(location => {
    const warehouse = location.location_type === "WAREHOUSE";
    return <div key={location.id} data-inventory-location={warehouse ? "warehouse" : "shop"} className={`rounded-xl px-3 py-1.5 ${warehouse ? "col-span-1 bg-stone-100 text-stone-600 sm:col-span-2" : "bg-stone-50"}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className={`truncate text-sm font-semibold ${warehouse ? "text-stone-700" : "text-stone-900"}`}>{historicalLocationDisplayName(location.name, locale)}</p>
        <span className={`zl-tabular shrink-0 text-sm font-medium ${warehouse ? "text-stone-600" : "text-amber-900"}`}>{Math.round(location.percentage)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className={`zl-inventory-progress h-full rounded-full ${warehouse ? "bg-stone-500/70" : "bg-amber-700/75"}`} style={{ width: `${Math.min(100, location.percentage)}%` }} />
      </div>
      <p className="zl-tabular mt-1 text-xs text-stone-600">{translate(locale, "dashboard.locationItems", { count: location.inStock })}</p>
    </div>;
  })}</div>;
}
