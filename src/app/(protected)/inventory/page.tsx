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
  INVENTORY_SORTS,
  type InventorySort,
  type SortDirection,
  type InventoryFilters as InventoryFilterValues,
} from "@/lib/inventory/queries";
import { getTranslations } from "@/lib/i18n/server";
import { PageHeading } from "@/components/ui/page-heading";
import { buttonStyles } from "@/components/ui/button";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("inventory.title") }; }

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parameter(params: Record<string, string | string[] | undefined>, name: string) {
  const value = params[name];
  return typeof value === "string" ? value : "";
}
export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslations();
  const params = await searchParams;
  const barcode = parameter(params, "barcode");

  const hasStatus = Object.prototype.hasOwnProperty.call(params, "status");
  const rawStatus = parameter(params, "status");
  const requestedPage = Number(parameter(params, "page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filters: InventoryFilterValues = {
    barcode,
    article: parameter(params, "article"),
    category: parameter(params, "category"),
    shop: parameter(params, "shop"),
    createdDate: parameter(params, "createdDate"),
    status: rawStatus === "ALL" ? "ALL" : (["IN_STOCK", "SOLD"] as InventoryStatus[]).includes(rawStatus as InventoryStatus) ? rawStatus as InventoryStatus : hasStatus ? "ALL" : "IN_STOCK",
  };
  const employee = await getCurrentEmployee();
  const rawSort = parameter(params, "sort");
  const requestedSort = INVENTORY_SORTS.includes(rawSort as InventorySort) ? rawSort as InventorySort : "createdDate";
  const sort = requestedSort === "purchasePrice" && employee.role !== "owner" ? "createdDate" : requestedSort;
  const direction: SortDirection = parameter(params, "direction") === "asc" ? "asc" : "desc";
  const inventoryPromise = getInventoryItems(filters, page, 50, sort, direction);
  const [options, inventory] = await Promise.all([getInventoryOptions(employee.role === "owner"), inventoryPromise]);
  const { items, count, pageSize } = inventory;
  const canManage = canManageInventory(employee.role);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const currentQuery = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])).toString();
  const pageHref = (nextPage: number) => inventoryPageHref(currentQuery, nextPage);

  return <section>
    <PageHeading title={t("inventory.title")} actions={canManage ? <><Link href="/inventory/import" className={buttonStyles("secondary")}>{t("inventory.import")}</Link><Link href="/inventory/new" className={buttonStyles("primary")}>{t("inventory.add")}</Link></> : null} />

    <InventoryFilters key={currentQuery} filters={filters} role={employee.role} categories={options.categories} shops={options.shops}>
    <div className="zl-surface mt-6 overflow-hidden">
      {items.length === 0 ? <div className="p-10 text-center">
        <h2 className="font-medium">{t("inventory.noItems")}</h2>
        <p className="mt-2 text-sm text-stone-600">{t("inventory.clearFilters")}{canManage ? t("inventory.orAdd") : ""}.</p>
      </div> : <InventoryBulkTable items={items} shops={options.shops} page={page} pageSize={pageSize} count={count} canManage={canManage} currentQuery={currentQuery} sort={sort} direction={direction}/>}
    </div>
    <nav aria-label={t("inventory.pages")} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-stone-700">{inventoryResultSummary(page, pageSize, count, items.length, locale)}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={pageHref(page - 1)} className={buttonStyles("secondary")}>{t("common.previous")}</Link> : null}
        {Array.from({length:totalPages},(_,index)=>index+1).filter(value=>totalPages<=7||Math.abs(value-page)<=2||value===1||value===totalPages).map(value=><Link key={value} href={pageHref(value)} aria-current={value===page?"page":undefined} className={buttonStyles(value===page?"primary":"secondary","min-w-10 px-3")}>{value}</Link>)}
        {page < totalPages ? <Link href={pageHref(page + 1)} className={buttonStyles("secondary")}>{t("common.next")}</Link> : null}
      </div>
    </nav></InventoryFilters>
  </section>;
}
