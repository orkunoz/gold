import { getTranslations } from "@/lib/i18n/server";
import Link from "next/link";
import { displayValue, formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getSaleDetail } from "@/lib/sales/queries";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("sales.details") }; }

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getTranslations();
  const { sale, items } = await getSaleDetail(id);
  const discountTotal=items.reduce((total,item)=>total+(Number(item.list_price??item.sale_price)-Number(item.sale_price)),0);
  return <section className="max-w-5xl">
    <Link href="/sales" className="text-sm font-medium text-stone-600 hover:text-stone-900">← {t("sales.title")}</Link>
    <div className="mt-8"><p className="text-xs font-medium uppercase tracking-widest text-stone-500">{t("sales.completedDetail")}</p><h1 className="mt-3 break-all text-3xl font-semibold">{sale.sale_number}</h1></div>
    <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">
      {[[t("sales.soldAt"), formatDateTime(sale.sold_at,locale)], [t("fields.shop"), sale.shops?.name ?? sale.shop_name ?? t("common.unassigned")], [t("sales.employee"), sale.employees?.full_name ?? sale.employee_name ?? sale.employee_username ?? t("common.deletedAccount")], [t("sales.items"), String(items.length)], [t("sales.subtotal"), formatPrice(sale.total_list_price,locale)], [t("sales.discounts"), `-${formatPrice(discountTotal,locale)}`], [t("sales.finalTotal"), formatPrice(sale.total_sale_price,locale)]].map(([label, value]) => <div key={label} className="bg-white p-5"><dt className="text-xs font-medium uppercase text-stone-500">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}
    </dl>
    <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5"><h2 className="font-semibold">{t("fields.notes")}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{sale.notes || t("sales.noNotes")}</p></div>
    <div className="zl-table-wrap mt-8"><table className="zl-table min-w-[760px]">
      <thead><tr>{[t("sales.product"), t("fields.article"), t("sales.listPrice"), t("fields.discount"), t("fields.salePrice")].map((heading,index) => <th key={heading} className={index >= 2 ? "zl-table-number" : ""}>{heading}</th>)}</tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}><td className="font-semibold"><Link href={`/inventory/${item.inventory_item_id}`} className="hover:underline">{item.category_name??item.barcode??t("sales.product")}</Link></td><td>{displayValue(item.article_number)}</td><td className="zl-table-number">{formatPrice(item.list_price,locale)}</td><td className="zl-table-number">{item.discount_percent}%</td><td className="zl-table-number font-semibold">{formatPrice(item.sale_price,locale)}</td></tr>)}</tbody>
    </table></div>
  </section>;
}
