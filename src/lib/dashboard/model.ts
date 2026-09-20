import type { EmployeeRole } from "@/lib/database.types";
import { kyivCalendarDateBoundaries } from "@/lib/inventory/created-date";

export const REPORTING_PERIODS = ["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH", "ALL_TIME", "CUSTOM"] as const;
export type ReportingPeriod = typeof REPORTING_PERIODS[number];
export const PERIOD_LABELS: Record<ReportingPeriod, string> = { TODAY: "Today", LAST_7_DAYS: "Last 7 days", LAST_30_DAYS: "Last 30 days", THIS_MONTH: "This month", LAST_MONTH: "Last month", ALL_TIME: "All time", CUSTOM: "Custom Range" };
export function reportingPeriod(value: string | undefined): ReportingPeriod { return REPORTING_PERIODS.includes(value as ReportingPeriod) ? value as ReportingPeriod : "THIS_MONTH"; }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function customDateRange(period: ReportingPeriod, startValue?: string, endValue?: string) {
  if (period !== "CUSTOM") return { start: null, end: null, error: null };
  const validDate = (value: string) => {
    if (!ISO_DATE.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  const start = startValue?.trim() ?? "";
  const end = endValue?.trim() || start;
  if (!validDate(start) || !validDate(end)) return { start: null, end: null, error: "Select a valid custom date or date range." };
  if (start > end) return { start: null, end: null, error: "Start date must be on or before end date." };
  return { start, end, error: null };
}
export function dashboardSections(role: EmployeeRole) { return { inventory: role === "owner", comparisons: role === "owner", shopPerformance: role === "owner" }; }

export const DASHBOARD_RECENT_SALES_LIMIT = 5;
export function recentSalesWindow<T>(sales: T[]) {
  return { sales: sales.slice(0, DASHBOARD_RECENT_SALES_LIMIT), hasMore: sales.length > DASHBOARD_RECENT_SALES_LIMIT };
}

export function formatDashboardRange(start: string, end: string, locale: "ua" | "en") {
  const parse = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); };
  const formatter = new Intl.DateTimeFormat(locale === "ua" ? "uk-UA" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return start === end ? formatter.format(parse(start)) : `${formatter.format(parse(start))} – ${formatter.format(parse(end))}`;
}

export function reportingBoundaries(period: ReportingPeriod, start?: string, end?: string, now = new Date()) {
  if (period === "ALL_TIME") return { start: null, end: null };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const value = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  let first = today; let last = today;
  if (period === "LAST_7_DAYS") first = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 6));
  if (period === "LAST_30_DAYS") first = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 29));
  if (period === "THIS_MONTH") first = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  if (period === "LAST_MONTH") { first = new Date(Date.UTC(parts.year, parts.month - 2, 1)); last = new Date(Date.UTC(parts.year, parts.month - 1, 0)); }
  if (period === "CUSTOM") { const range = customDateRange(period, start, end); if (range.error || !range.start || !range.end) return null; first = parseIso(range.start); last = parseIso(range.end); }
  const firstBoundary = kyivCalendarDateBoundaries(value(first)); const lastBoundary = kyivCalendarDateBoundaries(value(last));
  return firstBoundary && lastBoundary ? { start: firstBoundary.start, end: lastBoundary.end } : null;
}

function parseIso(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); }

export type DashboardReport = {
  role: EmployeeRole; period: ReportingPeriod; timezone: "Europe/Kyiv"; start_at: string; end_at: string; shop_id: string | null;
  kpis: { revenue: number; sales_count: number; items_sold: number; gold_weight_sold: number; average_sale: number };
  profit?: { net_profit:number; missing_purchase_cost_items:number };
  inventory: null | { in_stock_items: number; in_stock_weight: number; customer_value: number; missing_price_items: number };
  status_counts: null | Record<"IN_STOCK" | "SOLD", number>;
  recent_sales: { id: string; sale_number: string; sold_at: string; shop: string; employee: string; category_summary: string; item_count: number; total_sale_price: number }[];
  sales_over_time: null | { date: string; revenue: number; items_sold: number }[];
  categories: null | { category: string; items_sold: number; revenue: number; weight_sold: number }[];
  shops: null | { shop_id: string; shop: string; revenue: number; sales_count: number; items_sold: number; weight_sold: number; in_stock_items: number; in_stock_weight: number; inventory_value: number; trend?: number[] }[];
};
