import Link from "next/link";
import { SalesCheckout } from "@/components/sales-checkout";
import { formatDateTime, formatPrice } from "@/lib/inventory/format";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
import { getSalesRegister, getSoldProductsRegister } from "@/lib/sales/queries";
import { inventoryOrdinal, inventoryResultSummary } from "@/lib/inventory/pagination";
import { parseSalesRegisterFilters, productSummary } from "@/lib/sales/register";

export const metadata = { title: "Sales" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseSalesRegisterFilters({ page: params.page });
  const view=typeof params.view==="string"&&params.view==="sales"?"sales":"products";
  const productFilters={shopId:null,category:null,producer:null,metal:null,employeeId:null,from:null,to:null,search:null,page:filters.page};
  const [employee, options, history,products] = await Promise.all([getCurrentEmployee(),getInventoryOptions(),getSalesRegister(filters),getSoldProductsRegister(productFilters)]);
  const page = history.page;
  const totalPages = Math.max(1, Math.ceil(history.count / history.pageSize));
  const pageHref=(nextPage:number)=>`/sales?view=sales${nextPage>1?`&page=${nextPage}`:""}`;
  const productPageHref=(nextPage:number)=>`/sales${nextPage>1?`?page=${nextPage}`:""}`;

  return <section>
    <div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Sales workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Checkout</h1><p className="mt-2 text-sm text-stone-600">Scan physical items, confirm final prices, and complete one atomic sale.</p></div>
    <div className="mt-8"><SalesCheckout employee={employee} shops={options.shops} /></div>

    <div className="mt-12 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Read-only history</p><h2 className="mt-2 text-2xl font-semibold">Sales register</h2></div><span className="text-sm text-stone-500">{history.count} sale{history.count===1?"":"s"}</span></div>
    <nav className="mt-5 flex gap-2"><Link href="/sales" className={`rounded-lg px-5 py-2.5 text-sm font-medium ${view==="products"?"bg-stone-900 text-white":"border bg-white"}`}>Products</Link><Link href="/sales?view=sales" className={`rounded-lg px-5 py-2.5 text-sm font-medium ${view==="sales"?"bg-stone-900 text-white":"border bg-white"}`}>Sales</Link></nav>
    {view==="products"?<>
    <p className="mt-5 font-medium">{inventoryResultSummary(products.page,products.pageSize,products.count,products.products.length)}</p>
    <div className="mt-3 overflow-x-auto rounded-xl border bg-white"><table className="min-w-[1800px] w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Number","Product Category","Producer","Size","Article","Weight","Price per Gram","List Price","Discount %","Sale Price","Status","Shop","Barcode","Notes","Sale Number","Sale Date","Salesperson"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{products.products.map((p,index)=><tr key={p.id}><td className="px-4 py-3">{inventoryOrdinal(products.page,products.pageSize,index)}</td><td className="px-4 py-3"><Link href={`/inventory/${p.inventory_item_id}`} className="font-medium text-amber-900 hover:underline">{p.category_name??"Uncategorized"}</Link></td><td className="px-4 py-3">{p.producer??"—"}</td><td className="px-4 py-3">{p.size??"—"}</td><td className="px-4 py-3">{p.article_number??"—"}</td><td className="px-4 py-3">{p.weight_grams===null?"—":`${p.weight_grams} g`}</td><td className="px-4 py-3">{formatPrice(p.price_per_gram)}</td><td className="px-4 py-3">{formatPrice(p.list_price)}</td><td className="px-4 py-3">{p.discount_percent}%</td><td className="px-4 py-3">{formatPrice(p.sale_price)}</td><td className="px-4 py-3">Sold</td><td className="px-4 py-3">{p.shop_name}</td><td className="px-4 py-3">{p.barcode??"—"}</td><td className="px-4 py-3">{p.notes??"—"}</td><td className="px-4 py-3"><Link href={`/sales/${p.sale_id}`} className="text-amber-900 hover:underline">{p.sale_number}</Link></td><td className="px-4 py-3">{formatDateTime(p.sold_at)}</td><td className="px-4 py-3">{p.employee_name}</td></tr>)}</tbody></table></div>
    {Math.ceil(products.count/products.pageSize)>1?<nav className="mt-5 flex justify-between"><span className="text-sm">Page {products.page} of {Math.ceil(products.count/products.pageSize)}</span><div className="flex gap-2">{products.page>1?<Link className="rounded-lg border bg-white px-4 py-2 text-sm" href={productPageHref(products.page-1)}>Previous</Link>:null}{products.page<Math.ceil(products.count/products.pageSize)?<Link className="rounded-lg border bg-white px-4 py-2 text-sm" href={productPageHref(products.page+1)}>Next</Link>:null}</div></nav>:null}
    </>:<>
    <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {history.sales.length === 0 ? <p className="p-10 text-center text-sm text-stone-500">No sales recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Sale number", "Date", "Shop", "Salesperson", "Products", "Items", "Total", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">{history.sales.map((sale) => <tr key={sale.id}>
          <td className="px-4 py-3 font-semibold">{sale.sale_number}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(sale.sold_at)}</td><td className="px-4 py-3">{sale.shop}</td><td className="px-4 py-3">{sale.employee}</td><td className="px-4 py-3">{productSummary(sale.products)||"—"}</td><td className="px-4 py-3">{sale.item_count}</td><td className="px-4 py-3 whitespace-nowrap font-medium">{formatPrice(sale.total_sale_price)}</td><td className="px-4 py-3 text-right"><Link href={`/sales/${sale.id}`} className="font-medium text-amber-900 hover:underline">Details</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    {totalPages > 1 ? <nav aria-label="Sales register pages" className="mt-5 flex items-center justify-between"><span className="text-sm text-stone-600">Page {page} of {totalPages}</span><div className="flex gap-2">{page > 1 ? <Link href={pageHref(page-1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Previous</Link> : null}{page < totalPages ? <Link href={pageHref(page+1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Next</Link> : null}</div></nav> : null}
    </>}
  </section>;
}
