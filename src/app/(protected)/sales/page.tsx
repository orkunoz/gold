import Link from "next/link";
import { SalesCheckout } from "@/components/sales-checkout";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
import { getRecentSales } from "@/lib/sales/queries";

export const metadata = { title: "Sales" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedPage = Number(typeof params.page === "string" ? params.page : "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [employee, options, history] = await Promise.all([getCurrentEmployee(), getInventoryOptions(), getRecentSales(page)]);
  const totalPages = Math.max(1, Math.ceil(history.count / history.pageSize));

  return <section>
    <div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Sales workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Checkout</h1><p className="mt-2 text-sm text-stone-600">Scan physical items, confirm final prices, and complete one atomic sale.</p></div>
    <div className="mt-8"><SalesCheckout employee={employee} shops={options.shops} /></div>

    <div className="mt-12 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Read-only history</p><h2 className="mt-2 text-2xl font-semibold">Recent sales</h2></div><span className="text-sm text-stone-500">{history.count} total</span></div>
    <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {history.sales.length === 0 ? <p className="p-10 text-center text-sm text-stone-500">No completed sales yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Sale number", "Date", "Employee", "Shop", "Items", "Total", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">{history.sales.map((sale) => <tr key={sale.id}>
          <td className="px-4 py-3 font-semibold">{sale.sale_number}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(sale.sold_at)}</td><td className="px-4 py-3">{sale.employees?.full_name || "Staff member"}</td><td className="px-4 py-3">{sale.shops?.name || "—"}</td><td className="px-4 py-3">{sale.sale_items[0]?.count ?? 0}</td><td className="px-4 py-3 whitespace-nowrap font-medium">{formatPrice(sale.total_sale_price)}</td><td className="px-4 py-3 text-right"><Link href={`/sales/${sale.id}`} className="font-medium text-amber-900 hover:underline">View</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    {totalPages > 1 ? <nav aria-label="Sales history pages" className="mt-5 flex items-center justify-between"><span className="text-sm text-stone-600">Page {page} of {totalPages}</span><div className="flex gap-2">{page > 1 ? <Link href={`/sales?page=${page - 1}`} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Previous</Link> : null}{page < totalPages ? <Link href={`/sales?page=${page + 1}`} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Next</Link> : null}</div></nav> : null}
  </section>;
}
