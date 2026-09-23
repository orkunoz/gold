import "server-only";
import type { DashboardReport, ReportingPeriod } from "./model";
import { createClient } from "@/lib/supabase/server";
import { readWithRetry } from "@/lib/supabase/read";
import type { EmployeeRole } from "@/lib/database.types";
import { getEffectivePrices } from "@/lib/pricing/effective";

export async function getDashboardReport(period: ReportingPeriod, shopId: string | null, startDate: string | null = null, endDate: string | null = null, role?: EmployeeRole) {
  const supabase = await createClient();
  const [reportResult, profitResult] = await Promise.all([
    readWithRetry("dashboard_report", () => supabase.rpc("get_dashboard_report", { p_period: period, p_shop_id: shopId, p_start_date: startDate, p_end_date: endDate })),
    role === "owner" ? readWithRetry("dashboard_profit", () => supabase.rpc("get_net_profit_report", { p_period: period, p_shop_id: shopId, p_start_date: startDate, p_end_date: endDate })) : Promise.resolve(null),
  ]);
  const { data, error } = reportResult;
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unable to load dashboard reporting.");
  const report=data as unknown as DashboardReport;
  if (profitResult?.error) console.error("dashboard_secondary_fallback", { section: "profit" });
  else if (profitResult?.data) report.profit = profitResult.data as DashboardReport["profit"];
  return report;
}

export async function getInventoryLocationCounts() {
  const supabase = await createClient();
  const { data, error } = await readWithRetry("dashboard_inventory_location_counts", () => supabase.rpc("get_admin_shop_counts"));
  if (error) throw new Error("Unable to load inventory location counts.");
  return (data ?? []).map(row => ({ shop_id: row.shop_id, in_stock_count: Number(row.in_stock_count) }));
}

export async function getSalespersonInventorySummary(shopId: string) {
  const supabase = await createClient();
  const rows: { id: string; weight_grams: number | null }[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await readWithRetry("salesperson_inventory_summary", () => supabase.from("inventory_items").select("id,weight_grams").eq("shop_id", shopId).eq("status", "IN_STOCK").order("id").range(from, from + 499));
    if (error) throw new Error("Unable to load the assigned-shop inventory summary.");
    rows.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  let customerValue = 0;
  let missingPriceItems = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const prices = await getEffectivePrices(supabase, rows.slice(offset, offset + 500).map(row => row.id));
    for (const row of rows.slice(offset, offset + 500)) {
      const price = prices.get(row.id)?.effective_price;
      if (price === null || price === undefined) missingPriceItems += 1;
      else customerValue += Number(price);
    }
  }
  return { in_stock_items: rows.length, in_stock_weight: rows.reduce((sum, row) => sum + Number(row.weight_grams ?? 0), 0), customer_value: customerValue, missing_price_items: missingPriceItems };
}
