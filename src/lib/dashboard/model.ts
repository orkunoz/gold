import type { EmployeeRole } from "@/lib/database.types";

export const REPORTING_PERIODS = ["TODAY", "LAST_7_DAYS", "THIS_MONTH", "LAST_30_DAYS"] as const;
export type ReportingPeriod = typeof REPORTING_PERIODS[number];
export const PERIOD_LABELS: Record<ReportingPeriod, string> = { TODAY: "Today", LAST_7_DAYS: "Last 7 days", THIS_MONTH: "This month", LAST_30_DAYS: "Last 30 days" };
export function reportingPeriod(value: string | undefined): ReportingPeriod { return REPORTING_PERIODS.includes(value as ReportingPeriod) ? value as ReportingPeriod : "THIS_MONTH"; }
export function dashboardSections(role: EmployeeRole) { return { inventory: role === "owner", comparisons: role === "owner", shopPerformance: role === "owner" }; }

export type DashboardReport = {
  role: EmployeeRole; period: ReportingPeriod; timezone: "Europe/Kyiv"; start_at: string; end_at: string; shop_id: string | null;
  kpis: { revenue: number; sales_count: number; items_sold: number; gold_weight_sold: number; average_sale: number };
  inventory: null | { in_stock_items: number; in_stock_weight: number; customer_value: number; missing_price_items: number };
  status_counts: null | Record<"IN_STOCK" | "SOLD" | "REMOVED", number>;
  recent_sales: { id: string; sale_number: string; sold_at: string; shop: string; employee: string; category_summary: string; item_count: number; total_sale_price: number }[];
  sales_over_time: null | { date: string; revenue: number; sales_count: number }[];
  categories: null | { category: string; items_sold: number; revenue: number; weight_sold: number }[];
  shops: null | { shop_id: string; shop: string; revenue: number; sales_count: number; items_sold: number; weight_sold: number; in_stock_items: number; in_stock_weight: number; inventory_value: number }[];
};
