import Link from "next/link";
import { DashboardFilters } from "@/components/dashboard-filters";
import { SalesTrend } from "@/components/sales-trend";
import { getActiveLocations, getCurrentEmployee } from "@/lib/inventory/queries";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getDashboardReport, getInventoryLocationCounts } from "@/lib/dashboard/queries";
import { customDateRange, dashboardSections, reportingPeriod } from "@/lib/dashboard/model";
import { inventoryDistribution } from "@/lib/dashboard/inventory-distribution";
import { getTranslations } from "@/lib/i18n/server";
import { translate, localeTag, type Locale } from "@/lib/i18n/core";
import { historicalLocationDisplayName } from "@/lib/locations/display";
import { MetricCountUp } from "@/components/metric-count-up";
import { PageHeading } from "@/components/ui/page-heading";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("dashboard.title") }; }
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const textParam = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const grams = (value: number,locale:Locale) => `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 3 }).format(value)} ${translate(locale,"common.grams")}`;

function Sparkline({ values }: { values: number[] }) {
  if (!values.length || values.every(value => value === 0)) return <span className="text-xs text-stone-400">—</span>;
  if (values.length === 1) return <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="h-7 w-24" role="img" aria-label={String(values[0])}><path d="M8 20H92" stroke="var(--zl-border)" strokeWidth="1" vectorEffect="non-scaling-stroke"/><circle cx="50" cy="8" r="3.5" fill="var(--zl-gold)" vectorEffect="non-scaling-stroke"/></svg>;
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
  const [report, locationOptions, locationCounts] = await Promise.all([
    getDashboardReport(reportPeriod, shopId, range.start, range.end, employee.role),
    employee.role === "owner" ? getActiveLocations().catch(() => { console.error("dashboard_secondary_fallback", { section: "location_options" }); return null; }) : Promise.resolve([]),
    employee.role === "owner" ? getInventoryLocationCounts().catch(() => { console.error("dashboard_secondary_fallback", { section: "inventory_location_counts" }); return null; }) : Promise.resolve([]),
  ]);
  const shops = (locationOptions ?? []).filter(location => location.location_type === "SHOP");
  const distribution = locationOptions && locationCounts ? inventoryDistribution(locationOptions.map(location => ({ ...location, is_active: true })), locationCounts) : [];
  if (report.shops && locationOptions) { const active = new Set(shops.map(shop => shop.id)); report.shops = report.shops.filter(shop => active.has(shop.shop_id)); }
  const sections = dashboardSections(employee.role);

  return <section className="space-y-6" data-dashboard-content>
    <PageHeading title={t("dashboard.title")} />
    {range.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{t(range.error.startsWith("Start") ? "dashboard.reversedRange" : "dashboard.invalidRange")}</div> : null}

    <div className={`grid gap-4 ${sections.inventory ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,.8fr)]" : ""}`}>
      <section className="zl-surface p-5 sm:p-6" aria-labelledby="statistics-title">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><h2 id="statistics-title" className="zl-card-title text-stone-950">{t("dashboard.statistics")}</h2><DashboardFilters key={`${period}:${textParam(params.start)}:${textParam(params.end)}:${shopId ?? ""}`} period={period} start={textParam(params.start)} end={textParam(params.end)} shopId={shopId ?? ""} shops={shops} isOwner={employee.role === "owner"} /></div>
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)]">
          <div><p className="text-sm text-stone-500">{t("dashboard.revenue")}</p><p className="mt-1 text-3xl font-semibold tracking-[-.035em] text-stone-950 sm:text-[2.1rem]"><MetricCountUp value={report.kpis.revenue} locale={locale} /></p>{employee.role === "owner" && report.profit ? <div className="mt-4"><p className="text-xs font-medium uppercase tracking-wider text-stone-500">{t("dashboard.netProfit")}</p><p className="zl-success mt-1 text-xl font-semibold"><MetricCountUp value={report.profit.net_profit} locale={locale} /></p>{report.profit.missing_purchase_cost_items ? <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500">{t("dashboard.missingPurchaseCost",{count:report.profit.missing_purchase_cost_items})}</p> : null}</div> : null}</div>
          <dl className="grid grid-cols-2 gap-2 self-start"><div className="rounded-xl bg-stone-50 p-4"><dt className="text-xs text-stone-500">{t("dashboard.itemsSold")}</dt><dd className="mt-2 text-2xl font-semibold text-stone-950"><MetricCountUp value={report.kpis.items_sold} locale={locale} kind="number" /></dd></div><div className="rounded-xl bg-stone-50 p-4"><dt className="text-xs text-stone-500">{t("dashboard.goldWeightSold")}</dt><dd className="mt-2 text-2xl font-semibold text-stone-950"><MetricCountUp value={report.kpis.gold_weight_sold} locale={locale} kind="weight" suffix={` ${t("common.grams")}`} /></dd></div></dl>
        </div>
        {report.sales_over_time ? <div className="mt-6 border-t border-stone-200 pt-5"><h3 className="mb-3 text-sm font-semibold text-stone-900">{t("dashboard.salesActivity")}</h3><SalesTrend points={report.sales_over_time} /></div> : null}
      </section>

      {sections.inventory && report.inventory ? <section className="zl-surface p-5 sm:p-6" data-dashboard-inventory aria-labelledby="inventory-title"><div className="flex items-start justify-between gap-3"><div><h2 id="inventory-title" className="zl-card-title text-stone-950">{t("inventory.title")}</h2><p className="mt-1 text-xs text-stone-500">{t("dashboard.currentSnapshot")}</p></div><span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500">{t("dashboard.notPeriodFiltered")}</span></div><p className="mt-8 text-3xl font-semibold tracking-tight text-stone-950"><MetricCountUp value={report.inventory.customer_value} locale={locale} /></p><dl className="mt-6 space-y-2"><div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"><dt className="text-sm text-stone-600">{t("dashboard.inStock")}</dt><dd className="zl-tabular font-semibold text-stone-950">{report.inventory.in_stock_items}</dd></div><div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"><dt className="text-sm text-stone-600">{t("dashboard.inStockGoldWeight")}</dt><dd className="zl-tabular font-semibold text-stone-950">{grams(report.inventory.in_stock_weight,locale)}</dd></div></dl>{distribution.length ? <div className="mt-6 border-t border-stone-200 pt-5"><h3 className="text-sm font-semibold text-stone-900">{t("dashboard.inventoryByLocation")}</h3><p className="mt-1 text-xs text-stone-500">{t("dashboard.inventoryByLocationDescription")}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{distribution.map(location => <div key={location.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3"><div className="flex items-baseline justify-between gap-3"><p className="truncate text-sm font-semibold text-stone-900">{historicalLocationDisplayName(location.name,locale)}</p><span className="zl-tabular text-sm font-medium text-amber-900">{Math.round(location.percentage)}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="zl-inventory-progress h-full rounded-full bg-amber-700/75" style={{width:`${Math.min(100,location.percentage)}%`}} /></div><div className="mt-2 flex items-center justify-between gap-3 text-xs text-stone-600"><span className="zl-tabular">{t("dashboard.locationItems",{count:location.inStock})}</span><span className="zl-tabular text-right">{t("dashboard.locationShare",{count:location.inStock,total:location.totalInStock})}</span></div></div>)}</div></div> : null}</section> : null}
    </div>

    {sections.shopPerformance && report.shops ? <section className="zl-surface overflow-hidden"><div className="px-5 py-4"><h2 className="zl-card-title text-stone-950">{t("dashboard.shopPerformance")}</h2></div><div className="overflow-x-auto"><table className="zl-table min-w-[820px]"><thead><tr><th>{t("fields.shop")}</th><th className="zl-table-number">{t("dashboard.itemsSold")}</th><th className="zl-table-number">{t("dashboard.goldWeightSold")}</th><th className="zl-table-number">{t("dashboard.revenue")}</th><th className="zl-table-number">{t("dashboard.inStockGoldWeight")}<InfoTooltip label={t("dashboard.inStockCurrentNote")}>{t("dashboard.inStockCurrentNote")}</InfoTooltip></th><th>{t("dashboard.trend")}</th></tr></thead><tbody>{report.shops.map(row => <tr key={row.shop_id}><td className="font-semibold text-stone-900">{historicalLocationDisplayName(row.shop,locale)}</td><td className="zl-table-number">{row.items_sold}</td><td className="zl-table-number whitespace-nowrap">{grams(row.weight_sold,locale)}</td><td className="zl-table-number whitespace-nowrap">{formatPrice(row.revenue,locale)}</td><td className="zl-table-number whitespace-nowrap">{grams(row.in_stock_weight,locale)}</td><td><Sparkline values={row.trend ?? []} /></td></tr>)}</tbody></table></div></section> : null}

    <div className={`grid gap-4 ${sections.comparisons ? "xl:grid-cols-2" : ""}`}>
      {sections.comparisons ? <ReportTable title={t("dashboard.categoryPerformance")} headings={[t("fields.productCategory"),t("dashboard.itemsSold"),t("dashboard.revenue"),t("dashboard.goldWeightSold")]} empty={t("dashboard.noSales")} rows={(report.categories ?? []).map(row => [row.category,String(row.items_sold),formatPrice(row.revenue,locale),grams(row.weight_sold,locale)])} /> : null}
      <section className="zl-surface overflow-hidden"><div className="flex items-center justify-between px-5 py-4"><div><h2 className="zl-card-title text-stone-950">{t("dashboard.recentSales")}</h2><p className="mt-1 text-xs text-stone-500">{t("dashboard.recentSalesSubtitle")}</p></div><Link href="/sales" className="text-sm font-semibold text-amber-800 hover:text-amber-950">{t("dashboard.viewAll")} →</Link></div>{report.recent_sales.length ? <div className="overflow-x-auto"><table className="zl-table min-w-[620px]"><thead><tr>{[t("sales.saleId"),t("fields.shop"),t("dashboard.itemsSold"),t("common.total"),t("common.date")].map((heading,index) => <th key={heading} className={index === 2 || index === 3 ? "zl-table-number" : ""}>{heading}</th>)}</tr></thead><tbody>{report.recent_sales.map(sale => <tr key={sale.id}><td className="font-semibold"><Link href={`/sales/${sale.id}`} className="text-amber-800 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-950">{sale.sale_number}</Link></td><td>{historicalLocationDisplayName(sale.shop,locale)}</td><td className="zl-table-number">{sale.item_count}</td><td className="zl-table-number whitespace-nowrap font-medium">{formatPrice(sale.total_sale_price,locale)}</td><td className="whitespace-nowrap text-stone-500">{formatDateTime(sale.sold_at,locale)}</td></tr>)}</tbody></table></div> : <p className="border-t border-stone-200 px-5 py-8 text-sm text-stone-500">{t("dashboard.noSales")}</p>}</section>
    </div>
  </section>;
}

function ReportTable({ title, headings, rows, empty }: { title: string; headings: string[]; rows: string[][]; empty: string }) { return <section className="zl-surface overflow-hidden"><h2 className="zl-card-title px-5 py-4 text-stone-950">{title}</h2>{rows.length ? <div className="overflow-x-auto"><table className="zl-table"><thead><tr>{headings.map((heading,index) => <th key={heading} className={index > 0 ? "zl-table-number" : ""}>{heading}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={`${row[0]}-${index}`}>{row.map((cell,cellIndex) => <td key={`${cellIndex}-${cell}`} className={`whitespace-nowrap ${cellIndex > 0 ? "zl-table-number" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="border-t border-stone-200 px-5 py-8 text-sm text-stone-500">{empty}</div>}</section>; }
