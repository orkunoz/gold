import Link from "next/link";
import { DashboardFilters } from "@/components/dashboard-filters";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { customDateRange, reportingPeriod } from "@/lib/dashboard/model";
import { getSalesHistory } from "@/lib/sales/queries";
import { getTranslations } from "@/lib/i18n/server";
import { historicalLocationDisplayName } from "@/lib/locations/display";
import { localeTag } from "@/lib/i18n/core";
import { PageHeading } from "@/components/ui/page-heading";
import { buttonStyles } from "@/components/ui/button";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("sales.historyTitle") }; }
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const text = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export default async function SalesHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [{ t, locale }, employee] = await Promise.all([getTranslations(), getCurrentEmployee()]);
  const period = reportingPeriod(text(params.period));
  const range = customDateRange(period, text(params.start), text(params.end));
  const requestedShop = text(params.shop) || null;
  const page = Math.max(1, Number.parseInt(text(params.page), 10) || 1);
  const shops = employee.role === "owner" ? await getActiveShops() : [];
  const shopId = employee.role === "owner" ? (shops.some(shop => shop.id === requestedShop) ? requestedShop : null) : employee.shop_id;
  const effectivePeriod = range.error ? "THIS_MONTH" : period;
  const history = await getSalesHistory({ period: effectivePeriod, start: range.start ?? undefined, end: range.end ?? undefined, shopId, page });
  const pages = Math.max(1, Math.ceil(history.count / history.pageSize));
  const pageHref = (next: number) => { const query = new URLSearchParams(); query.set("period", period); if (shopId && employee.role === "owner") query.set("shop", shopId); if (period === "CUSTOM") { if (range.start) query.set("start", range.start); if (range.end) query.set("end", range.end); } query.set("page", String(next)); return `/sales?${query}`; };

  return <section className="space-y-5">
    <PageHeading title={t("sales.historyTitle")} description={t("sales.historySubtitle")} actions={<DashboardFilters key={`${period}:${range.start}:${range.end}:${shopId ?? ""}`} period={period} start={range.start ?? ""} end={range.end ?? ""} shopId={shopId ?? ""} shops={shops} isOwner={employee.role === "owner"} />} />
    {range.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{t("dashboard.invalidRange")}</div> : null}
    <div className="zl-surface overflow-hidden">
      {history.sales.length ? <div className="overflow-x-auto"><table className="zl-table min-w-[880px]"><thead><tr>{[t("sales.saleId"),t("common.date"),t("fields.shop"),t("sales.employee"),t("sales.items"),t("sales.weight"),t("common.total")].map((heading,index) => <th key={heading} className={index >= 4 ? "zl-table-number" : ""}>{heading}</th>)}</tr></thead><tbody>{history.sales.map(sale => <tr key={sale.id}><td className="whitespace-nowrap font-semibold"><Link href={`/sales/${sale.id}`} className="text-amber-800 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-950">{sale.sale_number}</Link></td><td className="whitespace-nowrap text-stone-600">{formatDateTime(sale.sold_at,locale)}</td><td>{historicalLocationDisplayName(sale.shops?.name ?? sale.shop_name ?? t("common.unassigned"),locale)}</td><td>{sale.employees?.username ?? sale.employee_username ?? sale.employees?.full_name ?? sale.employee_name ?? t("common.deletedAccount")}</td><td className="zl-table-number">{sale.items}</td><td className="zl-table-number whitespace-nowrap">{new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 3 }).format(sale.weight)} {t("common.grams")}</td><td className="zl-table-number whitespace-nowrap font-semibold">{formatPrice(sale.total_sale_price,locale)}</td></tr>)}</tbody></table></div> : <div className="px-5 py-12 text-center"><p className="text-sm font-medium text-stone-700">{t("dashboard.noSales")}</p></div>}
      <div className="flex items-center justify-between border-t border-stone-200 px-5 py-3 text-sm text-stone-500"><span>{t("sales.resultCount", { count: history.count })}</span><div className="flex items-center gap-2"><Link href={pageHref(Math.max(1,page-1))} aria-disabled={page <= 1} className={buttonStyles("secondary",page <= 1 ? "pointer-events-none opacity-40" : "")}>{t("common.previous")}</Link><span>{page} / {pages}</span><Link href={pageHref(Math.min(pages,page+1))} aria-disabled={page >= pages} className={buttonStyles("secondary",page >= pages ? "pointer-events-none opacity-40" : "")}>{t("common.next")}</Link></div></div>
    </div>
  </section>;
}
