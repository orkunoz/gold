import "server-only";
import type { DashboardReport, ReportingPeriod } from "./model";
import { createClient } from "@/lib/supabase/server";
import { readWithRetry } from "@/lib/supabase/read";
import type { EmployeeRole } from "@/lib/database.types";

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
