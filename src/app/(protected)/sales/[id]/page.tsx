import Link from "next/link";
import { displayValue, formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getSaleDetail } from "@/lib/sales/queries";

export const metadata = { title: "Sale details" };

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sale, items } = await getSaleDetail(id);
  const discountTotal=items.reduce((total,item)=>total+(Number(item.list_price??item.sale_price)-Number(item.sale_price)),0);
  return <section className="max-w-5xl">
    <Link href="/sales" className="text-sm font-medium text-stone-600 hover:text-stone-900">← Sales</Link>
    <div className="mt-8"><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Completed sale</p><h1 className="mt-3 break-all text-3xl font-semibold">{sale.sale_number}</h1></div>
    <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">
      {[["Sold at", formatDateTime(sale.sold_at)], ["Shop", sale.shops?.name ?? "—"], ["Employee", sale.employees?.full_name ?? "Staff member"], ["Items", String(items.length)], ["Subtotal / list total", formatPrice(sale.total_list_price)], ["Discounts", `-${formatPrice(discountTotal)}`], ["Final total", formatPrice(sale.total_sale_price)]].map(([label, value]) => <div key={label} className="bg-white p-5"><dt className="text-xs font-medium uppercase text-stone-500">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}
    </dl>
    <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5"><h2 className="font-semibold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{sale.notes || "No notes."}</p></div>
    <div className="mt-8 overflow-x-auto rounded-xl border border-stone-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm">
      <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Product", "Article", "List price", "Discount %", "Sale price"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
      <tbody className="divide-y divide-stone-100">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 font-semibold"><Link href={`/inventory/${item.inventory_item_id}`} className="hover:underline">{item.category_name??item.barcode??"Product"}</Link></td><td className="px-4 py-3">{displayValue(item.article_number)}</td><td className="px-4 py-3">{formatPrice(item.list_price)}</td><td className="px-4 py-3">{item.discount_percent}%</td><td className="px-4 py-3 font-semibold">{formatPrice(item.sale_price)}</td></tr>)}</tbody>
    </table></div>
  </section>;
}
