import "server-only";
import type { DashboardReport, ReportingPeriod } from "./model";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardReport(period: ReportingPeriod, shopId: string | null, startDate: string | null = null, endDate: string | null = null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_report", { p_period: period, p_shop_id: shopId, p_start_date: startDate, p_end_date: endDate });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unable to load dashboard reporting.");
  const report=data as unknown as DashboardReport;
  if(report.role==="owner") { const {data:profit,error:profitError}=await supabase.rpc("get_net_profit_report",{p_period:period,p_shop_id:shopId,p_start_date:startDate,p_end_date:endDate}); if(profitError)throw new Error("Unable to load net profit reporting."); report.profit=profit as DashboardReport["profit"]; }
  if(report.shops){const{data:warehouses}=await supabase.from("shops").select("id").eq("location_type","WAREHOUSE");const ids=new Set((warehouses??[]).map(x=>x.id));report.shops=report.shops.filter(shop=>!ids.has(shop.shop_id));}
  return report;
}
