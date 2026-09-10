import Link from "next/link";
import { SalesCheckout } from "@/components/sales-checkout";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
import { getSalesRegister, getSalesRegisterOptions } from "@/lib/sales/queries";
import { parseSalesRegisterFilters, productSummary, salesRegisterHref } from "@/lib/sales/register";

export const metadata = { title: "Sales" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseSalesRegisterFilters(params);
  const [employee, options, registerOptions, history] = await Promise.all([getCurrentEmployee(),getInventoryOptions(),getSalesRegisterOptions(),getSalesRegister(filters)]);
  const page = history.page;
  const totalPages = Math.max(1, Math.ceil(history.count / history.pageSize));
  const pageHref=(nextPage:number)=>salesRegisterHref({shopId:filters.shopId,category:filters.category},nextPage);

  return <section>
    <div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Sales workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Checkout</h1><p className="mt-2 text-sm text-stone-600">Scan physical items, confirm final prices, and complete one atomic sale.</p></div>
    <div className="mt-8"><SalesCheckout employee={employee} shops={options.shops} /></div>

    <div className="mt-12 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Read-only history</p><h2 className="mt-2 text-2xl font-semibold">Sales register</h2></div><span className="text-sm text-stone-500">{history.count} matching sale{history.count===1?"":"s"}</span></div>
    <form method="get" className="mt-5 grid gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      {employee.role==="owner"?<label className="text-sm font-medium">Shop<select name="shop" defaultValue={filters.shopId??""} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">All Shops</option>{registerOptions.shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>:<div><p className="text-sm font-medium">Shop</p><p className="mt-2 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2.5 text-sm">{registerOptions.shops.find(shop=>shop.id===employee.shop_id)?.name??"Assigned shop"}</p></div>}
      <label className="text-sm font-medium">Product type<select name="category" defaultValue={filters.category??""} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">All product types</option>{registerOptions.categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}<option value="UNCATEGORIZED">Uncategorized</option></select></label>
      <div className="flex gap-2"><button className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white">Apply filters</button><Link href="/sales" className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium">Clear filters</Link></div>
    </form>
    <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {history.sales.length === 0 ? <p className="p-10 text-center text-sm text-stone-500">No sales match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Sale number", "Date", "Shop", "Salesperson", "Products", "Items", "Total", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">{history.sales.map((sale) => <tr key={sale.id}>
          <td className="px-4 py-3 font-semibold">{sale.sale_number}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(sale.sold_at)}</td><td className="px-4 py-3">{sale.shop}</td><td className="px-4 py-3">{sale.employee}</td><td className="px-4 py-3">{productSummary(sale.products)||"—"}</td><td className="px-4 py-3">{sale.item_count}</td><td className="px-4 py-3 whitespace-nowrap font-medium">{formatPrice(sale.total_sale_price)}</td><td className="px-4 py-3 text-right"><Link href={`/sales/${sale.id}`} className="font-medium text-amber-900 hover:underline">Details</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    {totalPages > 1 ? <nav aria-label="Sales register pages" className="mt-5 flex items-center justify-between"><span className="text-sm text-stone-600">Page {page} of {totalPages}</span><div className="flex gap-2">{page > 1 ? <Link href={pageHref(page-1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Previous</Link> : null}{page < totalPages ? <Link href={pageHref(page+1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Next</Link> : null}</div></nav> : null}
  </section>;
}
