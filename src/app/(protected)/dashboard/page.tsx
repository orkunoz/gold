import Link from "next/link";
import { DashboardFilters } from "@/components/dashboard-filters";
import { SalesTrend } from "@/components/sales-trend";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getDashboardReport } from "@/lib/dashboard/queries";
import { customDateRange, dashboardSections, reportingPeriod } from "@/lib/dashboard/model";
import { getTranslations } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/core";

export const metadata = { title: "Dashboard" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const textParam = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const grams = (value: number,locale:Locale) => `${new Intl.NumberFormat(locale==="ua"?"uk-UA":"en-UA", { maximumFractionDigits: 3 }).format(value)} g`;
function Metric({ label, value, note }: { label: string; value: string; note?: string }) { return <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>{note ? <p className="mt-1 text-xs text-stone-500">{note}</p> : null}</div>; }

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslations();
  const params = await searchParams;
  const employee = await getCurrentEmployee();
  const requestedPeriod = reportingPeriod(textParam(params.period));
  const requestedShop = textParam(params.shop) || null;
  const period = requestedPeriod;
  const range = customDateRange(period, textParam(params.start), textParam(params.end));
  const shopId = employee.role === "owner" ? requestedShop : employee.shop_id;
  const reportPeriod = range.error ? "THIS_MONTH" : period;
  const [report, shops] = await Promise.all([getDashboardReport(reportPeriod, shopId, range.start, range.end), employee.role === "owner" ? getActiveShops() : Promise.resolve([])]);
  const sections = dashboardSections(employee.role);

  return <section>
    <div className="flex justify-start">
      <DashboardFilters period={period} start={textParam(params.start)} end={textParam(params.end)} shopId={shopId ?? ""} shops={shops} isOwner={employee.role === "owner"} />
    </div>
    {range.error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{range.error} Showing This Month instead.</p> : null}
    <div className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label={t("dashboard.revenue")} value={formatPrice(report.kpis.revenue,locale)} /><Metric label={t("dashboard.itemsSold")} value={String(report.kpis.items_sold)} /><Metric label={t("dashboard.goldWeightSold")} value={grams(report.kpis.gold_weight_sold,locale)} /></div>
    {sections.inventory && report.inventory ? <><div className="mt-10"><h2 className="text-xl font-semibold">{t("inventory.title")}</h2></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><Metric label={t("dashboard.inStock")} value={String(report.inventory.in_stock_items)} /><Metric label={t("dashboard.goldWeightSold")} value={grams(report.inventory.in_stock_weight,locale)} /><Metric label={t("dashboard.inventoryValue")} value={formatPrice(report.inventory.customer_value,locale)} /></div></> : null}
    {sections.comparisons && report.sales_over_time ? <div className="mt-10 min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">{t("dashboard.dailyRevenue")}</h2><div className="mt-5 min-w-0"><SalesTrend points={report.sales_over_time} /></div></div> : null}
    {sections.comparisons ? <div className="mt-10"><ReportTable title={t("dashboard.categoryPerformance")} headings={[t("fields.productCategory"),t("sales.items"),t("dashboard.revenue"),t("fields.weight")]} empty={t("dashboard.noSales")} rows={(report.categories ?? []).map((row) => [row.category,String(row.items_sold),formatPrice(row.revenue,locale),grams(row.weight_sold,locale)])} /></div> : null}
    {sections.shopPerformance && report.shops ? <div className="mt-10"><ReportTable title={t("dashboard.shopPerformance")} headings={[t("fields.shop"),t("dashboard.revenue"),t("sales.items"),t("fields.weight"),t("dashboard.inStock"),t("fields.weight"),t("dashboard.inventoryValue")]} empty={t("dashboard.noSales")} rows={report.shops.map((row) => [row.shop,formatPrice(row.revenue,locale),String(row.items_sold),grams(row.weight_sold,locale),String(row.in_stock_items),grams(row.in_stock_weight,locale),formatPrice(row.inventory_value,locale)])} /></div> : null}
    <div className="mt-10"><h2 className="text-xl font-semibold">{t("dashboard.recentSales")}</h2><div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">{report.recent_sales.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{["№",t("common.date"),t("fields.productCategory"),...(employee.role === "owner" ? [t("fields.shop"),t("admin.accounts")] : []),t("sales.items"),t("common.total"),""] .map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{report.recent_sales.map((sale) => <tr key={sale.id}><td className="px-4 py-3 font-semibold">{sale.sale_number}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(sale.sold_at,locale)}</td><td className="px-4 py-3">{sale.category_summary}</td>{employee.role === "owner" ? <><td className="px-4 py-3">{sale.shop}</td><td className="px-4 py-3">{sale.employee}</td></> : null}<td className="px-4 py-3">{sale.item_count}</td><td className="px-4 py-3 whitespace-nowrap">{formatPrice(sale.total_sale_price,locale)}</td><td className="px-4 py-3"><Link href={`/sales/${sale.id}`} className="font-medium text-amber-900 hover:underline">{t("sales.viewDetails")}</Link></td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-sm text-stone-500">{t("dashboard.noSales")}</p>}</div></div>
  </section>;
}

function ReportTable({ title, headings, rows, empty }: { title: string; headings: string[]; rows: string[][]; empty: string }) { return <div><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{headings.map((heading) => <th key={heading} className="px-4 py-3 whitespace-nowrap">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`} className="px-4 py-3 whitespace-nowrap">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-stone-500">{empty}</p>}</div></div>; }
