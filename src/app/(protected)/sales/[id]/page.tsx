import { getTranslations } from "@/lib/i18n/server";
import Link from "next/link";
import { displayValue, formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getSaleDetail } from "@/lib/sales/queries";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("sales.details") }; }

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getTranslations();
  const { sale, items } = await getSaleDetail(id);
  const discountTotal = items.reduce((total, item) => total + (Number(item.list_price ?? item.sale_price) - Number(item.sale_price)), 0);
  const employee = sale.employees?.full_name ?? sale.employee_name ?? sale.employee_username ?? t("common.deletedAccount");
  const summary = [
    [t("sales.soldAt"), formatDateTime(sale.sold_at, locale)],
    [t("fields.shop"), sale.shops?.name ?? sale.shop_name ?? t("common.unassigned")],
    [t("sales.employee"), employee],
    [t("sales.items"), String(items.length)],
    [t("sales.subtotal"), formatPrice(sale.total_list_price, locale)],
    [t("sales.discounts"), formatPrice(discountTotal, locale)],
  ];

  return <section data-sale-detail>
    <Link href="/sales" className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900">← {t("sales.title")}</Link>
    <header className="mt-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-500">{t("sales.completedDetail")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="whitespace-nowrap text-2xl font-semibold sm:text-4xl">{sale.sale_number}</h1>
          <span className="zl-status-sold rounded-full px-2.5 py-1 text-xs font-bold tracking-wide">{t("status.SOLD")}</span>
        </div>
      </div>
    </header>

    <section className="zl-surface mt-6 overflow-hidden" aria-label={t("sales.details")}>
      <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
        {summary.map(([label, value]) => <div key={label} className="border-b border-stone-200 p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</dt>
          <dd className="zl-tabular mt-1.5 text-sm font-semibold text-stone-900 sm:text-base">{value}</dd>
        </div>)}
      </dl>
      <div className="zl-sale-total flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <span className="text-xs font-bold uppercase tracking-wider">{t("sales.finalTotal")}</span>
        <strong className="zl-tabular text-2xl tracking-tight">{formatPrice(sale.total_sale_price, locale)}</strong>
      </div>
    </section>

    <section className="mt-7" aria-labelledby="sold-products-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="sold-products-title" className="zl-card-title text-stone-950">{t("sales.soldProducts")}</h2>
        <span className="text-sm text-stone-500">{t("sales.itemCount", { count: items.length })}</span>
      </div>
      <div className="zl-table-wrap"><table className="zl-table zl-table--dense min-w-[1320px]">
        <thead><tr>
          <th>{t("fields.productCategory")}</th><th>{t("fields.article")}</th><th>{t("fields.producer")}</th><th>{t("fields.size")}</th>
          <th className="zl-table-number">{t("fields.weight")}</th><th>{t("fields.barcode")}</th><th className="zl-table-number">{t("sales.listPrice")}</th>
          <th className="zl-table-number">{t("fields.discount")}</th><th className="zl-table-number">{t("fields.salePrice")}</th><th>{t("fields.status")}</th>
        </tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td className="font-semibold"><Link href={`/inventory/${item.inventory_item_id}`} className="hover:underline">{displayValue(item.category_name)}</Link></td>
          <td>{displayValue(item.article_number)}</td><td>{displayValue(item.producer)}</td><td>{displayValue(item.size)}</td>
          <td className="zl-table-number whitespace-nowrap">{item.weight_grams == null ? "—" : `${item.weight_grams} ${t("common.grams")}`}</td>
          <td className="font-mono text-xs">{displayValue(item.barcode)}</td><td className="zl-table-number whitespace-nowrap">{formatPrice(item.list_price, locale)}</td>
          <td className="zl-table-number whitespace-nowrap">{item.discount_percent}%</td><td className="zl-table-number whitespace-nowrap font-semibold">{formatPrice(item.sale_price, locale)}</td>
          <td><span className="zl-status-sold inline-flex rounded-full px-2 py-1 text-[11px] font-bold tracking-wide">{t("status.SOLD")}</span></td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </section>;
}
