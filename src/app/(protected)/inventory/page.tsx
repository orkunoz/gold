import Link from "next/link";
import type { InventoryStatus } from "@/lib/database.types";
import { InventoryStatus as StatusBadge } from "@/components/inventory-status";
import { INVENTORY_STATUSES, STATUS_LABELS } from "@/lib/inventory/constants";
import { displayValue, formatPrice } from "@/lib/inventory/format";
import { inventoryOrdinal, inventoryResultSummary } from "@/lib/inventory/pagination";
import {
  canManageInventory,
  getCurrentEmployee,
  getInventoryItems,
  getInventoryOptions,
  type InventoryFilters,
} from "@/lib/inventory/queries";

export const metadata = { title: "Inventory" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parameter(params: Record<string, string | string[] | undefined>, name: string) {
  const value = params[name];
  return typeof value === "string" ? value : "";
}
export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const barcode = parameter(params, "barcode");

  const rawStatus = parameter(params, "status");
  const requestedPage = Number(parameter(params, "page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filters: InventoryFilters = {
    barcode,
    article: parameter(params, "article"),
    category: parameter(params, "category"),
    metal: (["Gold", "Silver"] as const).find((value) => value === parameter(params, "metal")),
    shop: parameter(params, "shop"),
    search: parameter(params, "search"),
    status: INVENTORY_STATUSES.includes(rawStatus as InventoryStatus) ? rawStatus as InventoryStatus : undefined,
  };
  const [employee, options, inventory] = await Promise.all([getCurrentEmployee(), getInventoryOptions(), getInventoryItems(filters, page)]);
  const { items, count, pageSize } = inventory;
  const canManage = canManageInventory(employee.role);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  function pageHref(nextPage: number) {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (typeof value === "string" && key !== "mode" && key !== "page" && value) next.set(key, value); });
    if (nextPage > 1) next.set("page", String(nextPage));
    return `/inventory${next.size ? `?${next.toString()}` : ""}`;
  }

  return <section>
    <div className="flex flex-wrap justify-end gap-4">
      {canManage ? <div className="flex flex-wrap gap-3"><Link href="/inventory/import" className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100">Import inventory</Link><Link href="/inventory/new" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">Add product</Link></div> : null}
    </div>

    <form className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Barcode
          <input name="barcode" defaultValue={filters.barcode} placeholder="Filter by partial barcode" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium">Article number
          <input name="article" defaultValue={filters.article} placeholder="Article number" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium">Category
          <select name="category" defaultValue={filters.category} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">
            <option value="">All categories</option>
            {options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Status
          <select name="status" defaultValue={filters.status} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">
            <option value="">All statuses</option>
            {INVENTORY_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Metal
          <select name="metal" defaultValue={filters.metal} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">All metals</option><option value="Gold">Gold</option><option value="Silver">Silver</option></select>
        </label>
        {employee.role === "owner" ? <label className="text-sm font-medium">Shop
          <select name="shop" defaultValue={filters.shop} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">
            <option value="">All shops</option>
            {options.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
        </label> : null}
        <label className="text-sm font-medium lg:col-span-2">Text search
          <input name="search" defaultValue={filters.search} placeholder="Barcode, article, producer, or notes" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">Apply filters</button>
        <Link href="/inventory" className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Clear</Link>
      </div>
    </form>

    <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {items.length === 0 ? <div className="p-10 text-center">
        <h2 className="font-medium">No inventory items found</h2>
        <p className="mt-2 text-sm text-stone-600">Try clearing filters{canManage ? " or add the first product" : ""}.</p>
      </div> : <div className="overflow-x-auto">
        <table className="min-w-[1600px] w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr>
            {["Nr", "Product Category", "Producer", "Metal", "Fineness", "Size", "Weight", "Price per Gram", "Article", "Price (UAH)", "Notes", "Status", "Shop", "Barcode"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item, index) => <tr key={item.id} className="hover:bg-amber-50/40">
              <td className="px-4 py-3 font-medium"><Link href={`/inventory/${item.id}`} className="text-amber-900 underline-offset-4 hover:underline">{inventoryOrdinal(page, pageSize, index)}</Link></td>
              <td className="px-4 py-3">{item.product_categories?.name ?? "—"}</td>
              <td className="px-4 py-3">{displayValue(item.producer)}</td>
              <td className="px-4 py-3">{displayValue(item.metal)}</td>
              <td className="px-4 py-3">{displayValue(item.gold_fineness)}</td>
              <td className="px-4 py-3">{displayValue(item.size)}</td>
              <td className="px-4 py-3">{item.weight_grams === null ? "—" : `${item.weight_grams} g`}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatPrice(item.price_per_gram)}</td>
              <td className="px-4 py-3">{displayValue(item.article_number)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatPrice(item.price)}</td>
              <td className="max-w-80 px-4 py-3"><span className="line-clamp-2">{displayValue(item.notes)}</span></td>
              <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
              <td className="px-4 py-3">{item.shops?.name ?? "Unassigned"}</td>
              <td className="px-4 py-3 font-medium">{displayValue(item.barcode)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </div>
    <nav aria-label="Inventory pages" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-stone-700">{inventoryResultSummary(page, pageSize, count, items.length)}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Previous</Link> : null}
        {Array.from({length:totalPages},(_,index)=>index+1).filter(value=>totalPages<=7||Math.abs(value-page)<=2||value===1||value===totalPages).map(value=><Link key={value} href={pageHref(value)} aria-current={value===page?"page":undefined} className={`rounded-lg border px-4 py-2 text-sm font-medium ${value===page?"border-stone-900 bg-stone-900 text-white":"border-stone-300 bg-white"}`}>{value}</Link>)}
        {page < totalPages ? <Link href={pageHref(page + 1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Next</Link> : null}
      </div>
    </nav>
  </section>;
}
