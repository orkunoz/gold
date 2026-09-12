"use client";

import { useState } from "react";
import { formatDashboardDate, parseDashboardDate } from "@/lib/dashboard/date-only";
import { formatPrice } from "@/lib/inventory/format";
import { useI18n } from "./i18n-provider";

type Point = { date: string; revenue: number; items_sold: number };

export function chartPointPosition(points: Point[], index: number) {
  if (points.length <= 1) return 50;
  const first = parseDashboardDate(points[0].date)?.getTime();
  const current = parseDashboardDate(points[index].date)?.getTime();
  const last = parseDashboardDate(points.at(-1)!.date)?.getTime();
  if (first === undefined || current === undefined || last === undefined) return index / (points.length - 1) * 100;
  return last === first ? 50 : (current - first) / (last - first) * 100;
}

export function SalesTrend({ points }: { points: Point[] }) {
  const {t,locale}=useI18n(); const tag=locale==="ua"?"uk-UA":"en-UA";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.revenue));
  if (!points.length) return <p className="py-10 text-center text-sm text-stone-500">{t("dashboard.noDays")}</p>;
  return <div className="w-full min-w-0 overflow-hidden" data-chart-container="no-scrollbars">
    <div className="relative h-56 w-full min-w-0 border-b border-stone-300 bg-[linear-gradient(to_top,rgba(168,162,158,0.15)_1px,transparent_1px)] bg-[size:100%_25%] pt-3" role="img" aria-label={t("dashboard.chartLabel")}>
      {points.map((point, index) => {
        const height = Math.max(point.revenue ? 4 : 1, point.revenue / max * 192);
        const isFirst = index === 0 && points.length > 1;
        const isLast = index === points.length - 1 && points.length > 1;
        const horizontalAnchor = isFirst ? "" : isLast ? "-translate-x-full" : "-translate-x-1/2";
        const tooltipEdge = isFirst ? "left-0" : isLast ? "right-0" : "left-1/2 -translate-x-1/2";
        return <button key={`${point.date}-${index}`} type="button" className={`group absolute bottom-0 flex h-full w-3 items-end justify-center focus:outline-none sm:w-5 ${horizontalAnchor}`} style={{ left: `${chartPointPosition(points, index)}%` }} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} onClick={() => setActiveIndex(index)} aria-label={`${formatDashboardDate(point.date, { day: "numeric", month: "short", year: "numeric" },tag)}. ${t("dashboard.itemsSold")}: ${point.items_sold}. ${t("dashboard.revenue")}: ${formatPrice(point.revenue,locale)}.`}>
          {activeIndex === index ? <span role="tooltip" className={`pointer-events-none absolute z-10 w-40 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-stone-700 shadow-lg ${tooltipEdge}`} style={{ bottom: `${Math.min(height + 8, 154)}px` }}>
            <span className="block font-semibold text-stone-900">{formatDashboardDate(point.date, { day: "numeric", month: "short", year: "numeric" },tag)}</span>
            <span className="block">{t("dashboard.itemsSold")}: {point.items_sold}</span>
            <span className="block">{t("dashboard.revenue")}: {formatPrice(point.revenue,locale)}</span>
          </span> : null}
          <span className="block w-full rounded-t bg-amber-700 transition-colors group-hover:bg-amber-600 group-focus-visible:ring-2 group-focus-visible:ring-amber-900" style={{ height: `${height}px` }} />
        </button>;
      })}
    </div>
    <div className="mt-2 flex justify-between text-[10px] text-stone-500"><span>{formatDashboardDate(points[0].date, { month: "short", day: "numeric" },tag)}</span><span>{formatDashboardDate(points.at(-1)?.date, { month: "short", day: "numeric" },tag)}</span></div>
  </div>;
}
