import Link from "next/link";
import { redirect } from "next/navigation";
import type { InventoryStatus } from "@/lib/database.types";
import { InventoryStatus as StatusBadge } from "@/components/inventory-status";
import { INVENTORY_STATUSES, STATUS_LABELS } from "@/lib/inventory/constants";
import { displayValue, formatDate, formatPrice } from "@/lib/inventory/format";
import {
  canManageInventory,
  findInventoryItemByBarcode,
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
  if (parameter(params, "mode") === "exact" && barcode.trim()) {
    const exact = await findInventoryItemByBarcode(barcode);
    if (exact) redirect(`/inventory/${exact.id}`);
  }

  const rawStatus = parameter(params, "status");
  const filters: InventoryFilters = {
    barcode,
    article: parameter(params, "article"),
    category: parameter(params, "category"),
    shop: parameter(params, "shop"),
    search: parameter(params, "search"),
    status: INVENTORY_STATUSES.includes(rawStatus as InventoryStatus) ? rawStatus as InventoryStatus : undefined,
  };
  const [employee, options, items] = await Promise.all([getCurrentEmployee(), getInventoryOptions(), getInventoryItems(filters)]);
  const canManage = canManageInventory(employee.role);
  const exactMiss = parameter(params, "mode") === "exact" && Boolean(barcode.trim());

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-stone-500">Stock workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-2 text-sm text-stone-600">{items.length} item{items.length === 1 ? "" : "s"} shown · newest first</p>
      </div>
      {canManage ? <Link href="/inventory/new" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">Add product</Link> : null}
    </div>

    <form className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Barcode
          <input name="barcode" autoFocus defaultValue={filters.barcode} placeholder="Scan or enter barcode" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
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
        {employee.role === "owner" ? <label className="text-sm font-medium">Shop
          <select name="shop" defaultValue={filters.shop} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">
            <option value="">All shops</option>
            {options.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
        </label> : null}
        <label className="text-sm font-medium lg:col-span-2">Text search
          <input name="search" defaultValue={filters.search} placeholder="Barcode, article, or notes" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">Apply filters</button>
        <button name="mode" value="exact" className="rounded-lg border border-amber-700 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50">Open exact barcode</button>
        <Link href="/inventory" className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Clear</Link>
      </div>
      {exactMiss ? <p role="status" className="mt-4 text-sm text-amber-800">No accessible item has the exact barcode “{barcode.trim()}”.</p> : null}
    </form>

    <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {items.length === 0 ? <div className="p-10 text-center">
        <h2 className="font-medium">No inventory items found</h2>
        <p className="mt-2 text-sm text-stone-600">Try clearing filters{canManage ? " or add the first product" : ""}.</p>
      </div> : <div className="overflow-x-auto">
        <table className="min-w-[1280px] w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr>
            {["Barcode", "Article", "Category", "Fineness", "Color", "Weight", "Size", "Owner/base", "Selling", "Status", "Shop", "Received"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => <tr key={item.id} className="hover:bg-amber-50/40">
              <td className="px-4 py-3 font-medium"><Link href={`/inventory/${item.id}`} className="text-amber-900 underline-offset-4 hover:underline">{item.barcode}</Link></td>
              <td className="px-4 py-3">{displayValue(item.article_number)}</td>
              <td className="px-4 py-3">{item.product_categories?.name ?? "—"}</td>
              <td className="px-4 py-3">{displayValue(item.gold_fineness)}</td>
              <td className="px-4 py-3">{displayValue(item.gold_color)}</td>
              <td className="px-4 py-3">{item.weight_grams === null ? "—" : `${item.weight_grams} g`}</td>
              <td className="px-4 py-3">{displayValue(item.size)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatPrice(item.owner_price)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatPrice(item.selling_price)}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
              <td className="px-4 py-3">{item.shops?.name ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.received_at)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </div>
    {items.length === 200 ? <p className="mt-3 text-sm text-stone-500">Showing the newest 200 matches. Add filters to narrow the list.</p> : null}
  </section>;
}
