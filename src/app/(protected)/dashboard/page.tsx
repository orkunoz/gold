import Link from "next/link";
import { DashboardFilters } from "@/components/dashboard-filters";
import { SalesTrend } from "@/components/sales-trend";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getDashboardReport } from "@/lib/dashboard/queries";
import { customDateRange, dashboardSections, reportingPeriod } from "@/lib/dashboard/model";
import { getTranslations } from "@/lib/i18n/server";
import { translate, localeTag, type Locale } from "@/lib/i18n/core";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("dashboard.title") }; }
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const textParam = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const grams = (value: number,locale:Locale) => `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 3 }).format(value)} ${translate(locale,"common.grams")}`;
function Metric({ label, value, note }: { label: string; value: string; note?: string }) { return <div className="flex h-full min-h-24 flex-col justify-center rounded-lg border border-stone-200 bg-white px-4 py-4 shadow-sm"><p className="text-xs font-medium text-stone-500">{label}</p><p className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>{note ? <p className="mt-1 text-xs leading-4 text-stone-500">{note}</p> : null}</div>; }

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
  const [report, shopOptions] = await Promise.all([
    getDashboardReport(reportPeriod, shopId, range.start, range.end, employee.role),
    employee.role === "owner" ? getActiveShops().catch(() => { console.error("dashboard_secondary_fallback", { section: "shop_options" }); return null; }) : Promise.resolve([]),
  ]);
  const shops = shopOptions ?? [];
  if (report.shops && shopOptions) {
    const activeShopIds = new Set(shopOptions.map(shop => shop.id));
    report.shops = report.shops.filter(shop => activeShopIds.has(shop.shop_id));
  }
  const sections = dashboardSections(employee.role);

  return <section className="space-y-8" data-dashboard-content>
    <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-end lg:justify-between"><h1 className="text-2xl font-semibold tracking-tight text-stone-950">{t("dashboard.title")}</h1><DashboardFilters key={`${period}:${textParam(params.start)}:${textParam(params.end)}:${shopId ?? ""}`} period={period} start={textParam(params.start)} end={textParam(params.end)} shopId={shopId ?? ""} shops={shops} isOwner={employee.role === "owner"} /></div>
    {range.error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{t(range.error.startsWith("Start") ? "dashboard.reversedRange" : "dashboard.invalidRange")}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-dashboard-kpis><Metric label={t("dashboard.revenue")} value={formatPrice(report.kpis.revenue,locale)} /><Metric label={t("dashboard.itemsSold")} value={String(report.kpis.items_sold)} /><Metric label={t("dashboard.goldWeightSold")} value={grams(report.kpis.gold_weight_sold,locale)} />{employee.role === "owner" && report.profit ? <Metric label={t("dashboard.netProfit")} value={formatPrice(report.profit.net_profit,locale)} note={report.profit.missing_purchase_cost_items?t("dashboard.missingPurchaseCost",{count:report.profit.missing_purchase_cost_items}):undefined}/> : null}</div>
    {sections.inventory && report.inventory ? <section><h2 className="text-lg font-semibold text-stone-900">{t("inventory.title")}</h2><div className="mt-3 grid gap-3 sm:grid-cols-3" data-dashboard-inventory><Metric label={t("dashboard.inStock")} value={String(report.inventory.in_stock_items)} /><Metric label={t("dashboard.inStockGoldWeight")} value={grams(report.inventory.in_stock_weight,locale)} /><Metric label={t("dashboard.inventoryValue")} value={formatPrice(report.inventory.customer_value,locale)} /></div></section> : null}
    {sections.comparisons ? <div className="grid items-stretch gap-4 lg:grid-cols-2" data-dashboard-analytics><section className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"><h2 className="text-lg font-semibold text-stone-900">{t("dashboard.dailyRevenue")}</h2><div className="mt-3 min-w-0"><SalesTrend points={report.sales_over_time ?? []} /></div></section><ReportTable title={t("dashboard.categoryPerformance")} headings={[t("fields.productCategory"),t("dashboard.itemsSold"),t("dashboard.revenue"),t("dashboard.goldWeightSold")]} empty={t("dashboard.noSales")} rows={(report.categories ?? []).map((row) => [row.category,String(row.items_sold),formatPrice(row.revenue,locale),grams(row.weight_sold,locale)])} /></div> : null}
    {sections.shopPerformance && report.shops ? <ReportTable title={t("dashboard.shopPerformance")} headings={[t("fields.shop"),t("dashboard.revenue"),t("dashboard.itemsSold"),t("dashboard.goldWeightSold"),t("dashboard.inStock"),t("dashboard.inStockGoldWeight"),t("dashboard.inventoryValue")]} empty={t("dashboard.noSales")} rows={report.shops.map((row) => [row.shop,formatPrice(row.revenue,locale),String(row.items_sold),grams(row.weight_sold,locale),String(row.in_stock_items),grams(row.in_stock_weight,locale),formatPrice(row.inventory_value,locale)])} /> : null}
    <section><h2 className="text-lg font-semibold text-stone-900">{t("dashboard.recentSales")}</h2><div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">{report.recent_sales.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500"><tr>{["№",t("common.date"),t("fields.productCategory"),...(employee.role === "owner" ? [t("fields.shop"),t("admin.accounts")] : []),t("dashboard.itemsSold"),t("common.total")].map((heading) => <th key={heading} className="px-3 py-2.5 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{report.recent_sales.map((sale) => <tr key={sale.id}><td className="px-3 py-2.5 font-semibold"><Link href={`/sales/${sale.id}`} className="text-amber-900 underline underline-offset-4 focus-visible:outline-2">{sale.sale_number}</Link></td><td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(sale.sold_at,locale)}</td><td className="px-3 py-2.5">{sale.category_summary}</td>{employee.role === "owner" ? <><td className="px-3 py-2.5">{sale.shop}</td><td className="px-3 py-2.5">{sale.employee}</td></> : null}<td className="px-3 py-2.5">{sale.item_count}</td><td className="px-3 py-2.5 whitespace-nowrap">{formatPrice(sale.total_sale_price,locale)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-stone-500">{t("dashboard.noSales")}</p>}</div></section>
  </section>;
}

function ReportTable({ title, headings, rows, empty }: { title: string; headings: string[]; rows: string[][]; empty: string }) { return <section className="min-w-0"><h2 className="text-lg font-semibold text-stone-900">{title}</h2><div className="mt-3 h-[calc(100%-2.25rem)] min-h-64 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500"><tr>{headings.map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2.5 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`} className="whitespace-nowrap px-3 py-2.5">{cell}</td>)}</tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center p-6 text-center text-sm text-stone-500">{empty}</div>}</div></section>; }
