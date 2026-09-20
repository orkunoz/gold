import Link from "next/link";
import { DashboardFilters } from "@/components/dashboard-filters";
import { SalesTrend } from "@/components/sales-trend";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getDashboardReport } from "@/lib/dashboard/queries";
import { customDateRange, dashboardSections, reportingPeriod } from "@/lib/dashboard/model";
import { getTranslations } from "@/lib/i18n/server";
import { translate, localeTag, type Locale } from "@/lib/i18n/core";
import { historicalLocationDisplayName } from "@/lib/locations/display";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("dashboard.title") }; }
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const textParam = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const grams = (value: number,locale:Locale) => `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 3 }).format(value)} ${translate(locale,"common.grams")}`;

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-xs text-stone-400">—</span>;
  const max = Math.max(1, ...values); const min = Math.min(...values); const spread = Math.max(1, max - min);
  const points = values.map((value, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${24 - ((value - min) / spread * 20 + 2)}`).join(" ");
  return <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="h-7 w-24" role="img" aria-label={values.join(", ")}><polyline points={points} fill="none" stroke="var(--zl-gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslations();
  const params = await searchParams;
  const employee = await getCurrentEmployee();
  const period = reportingPeriod(textParam(params.period));
  const range = customDateRange(period, textParam(params.start), textParam(params.end));
  const requestedShop = textParam(params.shop) || null;
  const shopId = employee.role === "owner" ? requestedShop : employee.shop_id;
  const reportPeriod = range.error ? "THIS_MONTH" : period;
  const [report, shopOptions] = await Promise.all([
    getDashboardReport(reportPeriod, shopId, range.start, range.end, employee.role),
    employee.role === "owner" ? getActiveShops().catch(() => { console.error("dashboard_secondary_fallback", { section: "shop_options" }); return null; }) : Promise.resolve([]),
  ]);
  const shops = shopOptions ?? [];
  if (report.shops && shopOptions) { const active = new Set(shopOptions.map(shop => shop.id)); report.shops = report.shops.filter(shop => active.has(shop.shop_id)); }
  const sections = dashboardSections(employee.role);

  return <section className="space-y-6" data-dashboard-content>
    <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="eyebrow">Zlata</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">{t("dashboard.title")}</h1></div>
      <DashboardFilters key={`${period}:${textParam(params.start)}:${textParam(params.end)}:${shopId ?? ""}`} period={period} start={textParam(params.start)} end={textParam(params.end)} shopId={shopId ?? ""} shops={shops} isOwner={employee.role === "owner"} />
    </div>
    {range.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{t(range.error.startsWith("Start") ? "dashboard.reversedRange" : "dashboard.invalidRange")}</div> : null}

    <div className={`grid gap-4 ${sections.inventory ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,.8fr)]" : ""}`}>
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="statistics-title">
        <div className="flex items-center justify-between"><h2 id="statistics-title" className="text-lg font-semibold text-stone-950">{t("dashboard.statistics")}</h2><span className="rounded-full bg-stone-50 px-3 py-1 text-xs font-medium text-stone-500">{t(`dashboard.${({TODAY:"today",LAST_7_DAYS:"last7",LAST_30_DAYS:"last30",THIS_MONTH:"thisMonth",LAST_MONTH:"lastMonth",ALL_TIME:"allTime",CUSTOM:"custom"} as const)[reportPeriod]}`)}</span></div>
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)]">
          <div><p className="text-sm text-stone-500">{t("dashboard.revenue")}</p><p className="mt-1 text-4xl font-semibold tracking-[-.04em] text-stone-950 sm:text-5xl">{formatPrice(report.kpis.revenue,locale)}</p>{employee.role === "owner" && report.profit ? <div className="mt-4"><p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t("dashboard.netProfit")}</p><p className="mt-1 text-xl font-semibold text-stone-900">{formatPrice(report.profit.net_profit,locale)}</p>{report.profit.missing_purchase_cost_items ? <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500">{t("dashboard.missingPurchaseCost",{count:report.profit.missing_purchase_cost_items})}</p> : null}</div> : null}</div>
          <dl className="grid grid-cols-2 gap-2 self-start"><div className="rounded-xl bg-stone-50 p-4"><dt className="text-xs text-stone-500">{t("dashboard.itemsSold")}</dt><dd className="mt-2 text-2xl font-semibold text-stone-950">{report.kpis.items_sold}</dd></div><div className="rounded-xl bg-stone-50 p-4"><dt className="text-xs text-stone-500">{t("dashboard.goldWeightSold")}</dt><dd className="mt-2 text-2xl font-semibold text-stone-950">{grams(report.kpis.gold_weight_sold,locale)}</dd></div></dl>
        </div>
        {report.sales_over_time ? <div className="mt-6 border-t border-stone-200 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-stone-900">{t("dashboard.salesActivity")}</h3><span className="text-xs text-stone-500">{t("dashboard.itemsOverTime")}</span></div><SalesTrend points={report.sales_over_time} /></div> : null}
      </section>

      {sections.inventory && report.inventory ? <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" data-dashboard-inventory aria-labelledby="inventory-title"><div className="flex items-start justify-between gap-3"><div><h2 id="inventory-title" className="text-lg font-semibold text-stone-950">{t("inventory.title")}</h2><p className="mt-1 text-xs text-stone-500">{t("dashboard.currentSnapshot")}</p></div><span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500">{t("dashboard.notPeriodFiltered")}</span></div><div className="mt-8"><p className="text-sm text-stone-500">{t("dashboard.inventoryValue")}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">{formatPrice(report.inventory.customer_value,locale)}</p></div><dl className="mt-6 space-y-2"><div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"><dt className="text-sm text-stone-600">{t("dashboard.inStock")}</dt><dd className="font-semibold text-stone-950">{report.inventory.in_stock_items}</dd></div><div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"><dt className="text-sm text-stone-600">{t("dashboard.inStockGoldWeight")}</dt><dd className="font-semibold text-stone-950">{grams(report.inventory.in_stock_weight,locale)}</dd></div></dl></section> : null}
    </div>

    {sections.shopPerformance && report.shops ? <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="px-5 py-4"><h2 className="text-lg font-semibold text-stone-950">{t("dashboard.shopPerformance")}</h2><p className="mt-1 text-xs text-stone-500">{t("dashboard.inStockCurrentNote")}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500"><tr>{[t("fields.shop"),t("dashboard.itemsSold"),t("dashboard.revenue"),t("dashboard.goldWeightSold"),t("dashboard.inStockGoldWeight"),t("dashboard.trend")].map(heading => <th key={heading} className="whitespace-nowrap px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{report.shops.map(row => <tr key={row.shop_id}><td className="px-5 py-3.5 font-semibold text-stone-900">{historicalLocationDisplayName(row.shop,locale)}</td><td className="px-5 py-3.5">{row.items_sold}</td><td className="px-5 py-3.5 whitespace-nowrap">{formatPrice(row.revenue,locale)}</td><td className="px-5 py-3.5 whitespace-nowrap">{grams(row.weight_sold,locale)}</td><td className="px-5 py-3.5 whitespace-nowrap">{grams(row.in_stock_weight,locale)}</td><td className="px-5 py-2"><Sparkline values={row.trend ?? []} /></td></tr>)}</tbody></table></div></section> : null}

    <div className={`grid gap-4 ${sections.comparisons ? "xl:grid-cols-2" : ""}`}>
      {sections.comparisons ? <ReportTable title={t("dashboard.categoryPerformance")} headings={[t("fields.productCategory"),t("dashboard.itemsSold"),t("dashboard.revenue"),t("dashboard.goldWeightSold")]} empty={t("dashboard.noSales")} rows={(report.categories ?? []).map(row => [row.category,String(row.items_sold),formatPrice(row.revenue,locale),grams(row.weight_sold,locale)])} /> : null}
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex items-center justify-between px-5 py-4"><div><h2 className="text-lg font-semibold text-stone-950">{t("dashboard.recentSales")}</h2><p className="mt-1 text-xs text-stone-500">{t("dashboard.recentSalesSubtitle")}</p></div><Link href="/sales" className="text-sm font-semibold text-amber-800 hover:text-amber-950">{t("dashboard.viewAll")} →</Link></div>{report.recent_sales.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500"><tr>{[t("sales.saleId"),t("fields.shop"),t("dashboard.itemsSold"),t("common.total"),t("common.date")].map(heading => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{report.recent_sales.map(sale => <tr key={sale.id}><td className="px-5 py-3 font-semibold"><Link href={`/sales/${sale.id}`} className="text-amber-800 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-950">{sale.sale_number}</Link></td><td className="px-5 py-3">{historicalLocationDisplayName(sale.shop,locale)}</td><td className="px-5 py-3">{sale.item_count}</td><td className="px-5 py-3 whitespace-nowrap font-medium">{formatPrice(sale.total_sale_price,locale)}</td><td className="px-5 py-3 whitespace-nowrap text-stone-500">{formatDateTime(sale.sold_at,locale)}</td></tr>)}</tbody></table></div> : <p className="border-t border-stone-200 px-5 py-8 text-sm text-stone-500">{t("dashboard.noSales")}</p>}</section>
    </div>
  </section>;
}

function ReportTable({ title, headings, rows, empty }: { title: string; headings: string[]; rows: string[][]; empty: string }) { return <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><h2 className="px-5 py-4 text-lg font-semibold text-stone-950">{title}</h2>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500"><tr>{headings.map(heading => <th key={heading} className="whitespace-nowrap px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{rows.map((row,index) => <tr key={`${row[0]}-${index}`}>{row.map((cell,cellIndex) => <td key={`${cellIndex}-${cell}`} className="whitespace-nowrap px-5 py-3">{cell}</td>)}</tr>)}</tbody></table></div> : <div className="border-t border-stone-200 px-5 py-8 text-sm text-stone-500">{empty}</div>}</section>; }
