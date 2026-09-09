import { formatPrice } from "@/lib/inventory/format";

export function SalesTrend({ points }: { points: { date: string; revenue: number; sales_count: number }[] }) {
  const max = Math.max(1, ...points.map((point) => point.revenue));
  if (!points.length) return <p className="py-10 text-center text-sm text-stone-500">No reporting days available.</p>;
  return <div className="overflow-x-auto"><div className="flex h-64 min-w-[640px] items-end gap-2 border-b border-stone-300 px-2 pt-8" role="img" aria-label="Daily revenue chart">
    {points.map((point) => <div key={point.date} className="flex min-w-5 flex-1 flex-col items-center justify-end gap-2" title={`${point.date}: ${formatPrice(point.revenue)}, ${point.sales_count} sales`}>
      <span className="sr-only">{point.date}: {formatPrice(point.revenue)}, {point.sales_count} sales</span>
      <div className="w-full rounded-t bg-amber-700" style={{ height: `${Math.max(point.revenue ? 4 : 1, point.revenue / max * 180)}px` }} />
      <span className="rotate-45 whitespace-nowrap text-[10px] text-stone-500">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "Europe/Kyiv" }).format(new Date(point.date))}</span>
    </div>)}
  </div></div>;
}
