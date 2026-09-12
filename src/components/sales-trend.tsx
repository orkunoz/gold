"use client";

import { useState } from "react";
import { formatDashboardDate } from "@/lib/dashboard/date-only";
import { formatPrice } from "@/lib/inventory/format";

type Point = { date: string; revenue: number; items_sold: number };

export function SalesTrend({ points }: { points: Point[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.revenue));
  if (!points.length) return <p className="py-10 text-center text-sm text-stone-500">No reporting days available.</p>;
  const active = points[activeIndex ?? points.length - 1];

  return <div className="w-full min-w-0 overflow-hidden" data-chart-container="no-scrollbars">
    <div className="mb-4 min-h-16 rounded-lg bg-amber-50 px-4 py-3 text-sm text-stone-700" role="status" aria-live="polite">
      <p className="font-semibold text-stone-900">{formatDashboardDate(active.date, { day: "numeric", month: "short", year: "numeric" })}</p>
      <p>Items Sold: {active.items_sold}</p>
      <p>Revenue: {formatPrice(active.revenue)}</p>
    </div>
    <div className="flex h-48 w-full min-w-0 items-end gap-1 border-b border-stone-300" role="img" aria-label="Daily revenue chart with items sold and revenue tooltips">
      {points.map((point, index) => <button key={`${point.date}-${index}`} type="button" className="group flex h-full min-w-0 flex-1 items-end focus:outline-none" onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} aria-label={`${formatDashboardDate(point.date, { day: "numeric", month: "short", year: "numeric" })}. Items Sold: ${point.items_sold}. Revenue: ${formatPrice(point.revenue)}.`}>
        <span className="block w-full rounded-t bg-amber-700 transition-colors group-hover:bg-amber-600 group-focus-visible:ring-2 group-focus-visible:ring-amber-900" style={{ height: `${Math.max(point.revenue ? 4 : 1, point.revenue / max * 176)}px` }} />
      </button>)}
    </div>
    <div className="mt-2 flex justify-between text-[10px] text-stone-500"><span>{formatDashboardDate(points[0].date, { month: "short", day: "numeric" })}</span><span>{formatDashboardDate(points.at(-1)?.date, { month: "short", day: "numeric" })}</span></div>
  </div>;
}
