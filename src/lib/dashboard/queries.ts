import "server-only";
import type { DashboardReport, ReportingPeriod } from "./model";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardReport(period: ReportingPeriod, shopId: string | null, startDate: string | null = null, endDate: string | null = null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_report", { p_period: period, p_shop_id: shopId, p_start_date: startDate, p_end_date: endDate });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unable to load dashboard reporting.");
  return data as unknown as DashboardReport;
}
