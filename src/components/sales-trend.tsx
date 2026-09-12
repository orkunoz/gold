"use client";

import { useState } from "react";
import { formatDashboardDate } from "@/lib/dashboard/date-only";
import { formatPrice } from "@/lib/inventory/format";

type Point = { date: string; revenue: number; items_sold: number };

export function SalesTrend({ points }: { points: Point[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.revenue));
  if (!points.length) return <p className="py-10 text-center text-sm text-stone-500">No reporting days available.</p>;
  return <div className="w-full min-w-0 overflow-hidden" data-chart-container="no-scrollbars">
    <div className="relative grid h-56 w-full min-w-0 items-end gap-1 border-b border-stone-300 bg-[linear-gradient(to_top,rgba(168,162,158,0.15)_1px,transparent_1px)] bg-[size:100%_25%] px-1 pt-3" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 48px))`, justifyContent: "center" }} role="img" aria-label="Daily revenue chart with items sold and revenue tooltips">
      {points.map((point, index) => {
        const height = Math.max(point.revenue ? 4 : 1, point.revenue / max * 192);
        const tooltipEdge = index === 0 ? "left-0" : index === points.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
        return <button key={`${point.date}-${index}`} type="button" className="group relative flex h-full min-w-0 items-end justify-center focus:outline-none" onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} onClick={() => setActiveIndex(index)} aria-label={`${formatDashboardDate(point.date, { day: "numeric", month: "short", year: "numeric" })}. Items Sold: ${point.items_sold}. Revenue: ${formatPrice(point.revenue)}.`}>
          {activeIndex === index ? <span role="tooltip" className={`pointer-events-none absolute z-10 w-40 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-stone-700 shadow-lg ${tooltipEdge}`} style={{ bottom: `${Math.min(height + 8, 154)}px` }}>
            <span className="block font-semibold text-stone-900">{formatDashboardDate(point.date, { day: "numeric", month: "short", year: "numeric" })}</span>
            <span className="block">Items Sold: {point.items_sold}</span>
            <span className="block">Revenue: {formatPrice(point.revenue)}</span>
          </span> : null}
          <span className="block w-full rounded-t bg-amber-700 transition-colors group-hover:bg-amber-600 group-focus-visible:ring-2 group-focus-visible:ring-amber-900" style={{ height: `${height}px` }} />
        </button>;
      })}
    </div>
    <div className="mt-2 flex justify-between text-[10px] text-stone-500"><span>{formatDashboardDate(points[0].date, { month: "short", day: "numeric" })}</span><span>{formatDashboardDate(points.at(-1)?.date, { month: "short", day: "numeric" })}</span></div>
  </div>;
}
