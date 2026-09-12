import Link from "next/link";
import type { InventoryStatus } from "@/lib/database.types";
import { InventoryBulkTable } from "@/components/inventory-bulk-table";
import { InventoryFilters } from "@/components/inventory-filters";
import { inventoryResultSummary } from "@/lib/inventory/pagination";
import { inventoryPageHref } from "@/lib/inventory/filter-url";
import {
  canManageInventory,
  getCurrentEmployee,
  getInventoryItems,
  getInventoryOptions,
  type InventoryFilters as InventoryFilterValues,
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
  const filters: InventoryFilterValues = {
    barcode,
    article: parameter(params, "article"),
    category: parameter(params, "category"),
    shop: parameter(params, "shop"),
    search: parameter(params, "search"),
    status: (["IN_STOCK", "SOLD"] as InventoryStatus[]).includes(rawStatus as InventoryStatus) ? rawStatus as InventoryStatus : undefined,
  };
  const [employee, options, inventory] = await Promise.all([getCurrentEmployee(), getInventoryOptions(), getInventoryItems(filters, page)]);
  const { items, count, pageSize } = inventory;
  const canManage = canManageInventory(employee.role);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const currentQuery = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])).toString();
  const pageHref = (nextPage: number) => inventoryPageHref(currentQuery, nextPage);

  return <section>
    <div className="flex flex-wrap justify-end gap-4">
      {canManage ? <div className="flex flex-wrap gap-3"><Link href="/inventory/import" className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100">Import inventory</Link><Link href="/inventory/new" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">Add product</Link></div> : null}
    </div>

    <InventoryFilters key={currentQuery} filters={filters} role={employee.role} categories={options.categories} shops={options.shops}>
    <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {items.length === 0 ? <div className="p-10 text-center">
        <h2 className="font-medium">No inventory items found</h2>
        <p className="mt-2 text-sm text-stone-600">Try clearing filters{canManage ? " or add the first product" : ""}.</p>
      </div> : <InventoryBulkTable items={items} shops={options.shops} page={page} pageSize={pageSize} canManage={canManage}/>}
    </div>
    <nav aria-label="Inventory pages" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-stone-700">{inventoryResultSummary(page, pageSize, count, items.length)}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Previous</Link> : null}
        {Array.from({length:totalPages},(_,index)=>index+1).filter(value=>totalPages<=7||Math.abs(value-page)<=2||value===1||value===totalPages).map(value=><Link key={value} href={pageHref(value)} aria-current={value===page?"page":undefined} className={`rounded-lg border px-4 py-2 text-sm font-medium ${value===page?"border-stone-900 bg-stone-900 text-white":"border-stone-300 bg-white"}`}>{value}</Link>)}
        {page < totalPages ? <Link href={pageHref(page + 1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Next</Link> : null}
      </div>
    </nav></InventoryFilters>
  </section>;
}
