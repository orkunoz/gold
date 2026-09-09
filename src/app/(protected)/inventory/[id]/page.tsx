import Link from "next/link";
import { InventoryStatus } from "@/components/inventory-status";
import { displayValue, formatDate, formatPrice } from "@/lib/inventory/format";
import { canManageInventory, getCurrentEmployee, getInventoryItem } from "@/lib/inventory/queries";
import { scanAnotherHref, scanStatusWarning } from "@/lib/inventory/scanner";

export const metadata = { title: "Product details" };

export default async function InventoryItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const fromScanner = (await searchParams).from === "scan";
  const [item, employee] = await Promise.all([getInventoryItem(id), getCurrentEmployee()]);
  const statusWarning = scanStatusWarning(item.status);
  const details = [
    ["Article number", displayValue(item.article_number)], ["Category", item.product_categories?.name ?? "—"],
    ["Shop", item.shops?.name ?? "—"], ["Gold fineness", displayValue(item.gold_fineness)],
    ["Gold color", displayValue(item.gold_color)], ["Weight", item.weight_grams === null ? "—" : `${item.weight_grams} g`],
    ["Size", displayValue(item.size)], ["Owner/base price", formatPrice(item.owner_price)],
    ["Selling price", formatPrice(item.selling_price)], ["Received", formatDate(item.received_at)],
    ["Created", formatDate(item.created_at)], ["Last updated", formatDate(item.updated_at)],
    ["Created by", item.employees?.full_name ?? "—"],
  ];
  return <section className="max-w-5xl">
    <div className="flex flex-wrap gap-4">
      <Link href="/inventory" className="text-sm font-medium text-stone-600 hover:text-stone-900">← Inventory</Link>
      {fromScanner ? <Link href={scanAnotherHref()} className="text-sm font-semibold text-amber-900 hover:underline">Scan another item</Link> : null}
    </div>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Product barcode</p>
        <h1 className="mt-3 break-all text-3xl font-semibold tracking-tight">{item.barcode}</h1>
        <div className="mt-4"><InventoryStatus status={item.status} /></div></div>
      {canManageInventory(employee.role) ? <Link href={`/inventory/${item.id}/edit`} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">Edit product</Link> : null}
    </div>
    {statusWarning ? <div role="alert" className="mt-6 rounded-xl border-2 border-red-600 bg-red-50 p-5 text-lg font-semibold text-red-950">{statusWarning}</div> : null}
    <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">
      {details.map(([label, value]) => <div key={label} className="bg-white p-5"><dt className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-2 break-words text-sm font-medium text-stone-900">{value}</dd></div>)}
    </dl>
    <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6"><h2 className="font-medium">Notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{item.notes || "No notes."}</p></div>
  </section>;
}
