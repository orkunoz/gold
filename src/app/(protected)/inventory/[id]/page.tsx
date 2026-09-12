import Link from "next/link";
import { InventoryStatus } from "@/components/inventory-status";
import { displayValue, formatDateTime, formatPrice } from "@/lib/inventory/format";
import { canManageInventory, getCurrentEmployee, getInventoryHistory, getInventoryItem } from "@/lib/inventory/queries";
import { deleteInventoryItemPermanently } from "@/lib/inventory/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";

export const metadata = { title: "Product details" };

export default async function InventoryItemPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{error?:string}> }) {
  const { id } = await params;
  const {error}=await searchParams;
  const [item, employee, history] = await Promise.all([getInventoryItem(id), getCurrentEmployee(), getInventoryHistory(id)]);
  const details = [
    ["Product Category", item.product_categories?.name ?? "—"], ["Producer", displayValue(item.producer)],
    ["Metal", displayValue(item.metal)], ["Fineness", displayValue(item.gold_fineness)], ["Size", displayValue(item.size)],
    ["Weight", item.weight_grams === null ? "—" : `${item.weight_grams} g`], ["Price per Gram", formatPrice(item.price_per_gram)],
    ["Article", displayValue(item.article_number)], ["Price (UAH)", formatPrice(item.price)], ["Notes", item.notes || "—"],
    ["Status", item.status.replace("_", " ")], ["Shop", item.shops?.name ?? "Unassigned"], ["Barcode", displayValue(item.barcode)],
  ];
  const canDelete=canManageInventory(employee.role)&&item.status!=="SOLD";
  return <section className="max-w-5xl"><Link href="/inventory" className="text-sm font-medium text-stone-600">← Inventory</Link>{error?<p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>:null}<div className="mt-6 flex flex-wrap items-center justify-between gap-4"><InventoryStatus status={item.status}/>{canManageInventory(employee.role)?<div className="flex items-center gap-4"><Link href={`/inventory/${item.id}/edit`} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">Edit product</Link>{canDelete?<ConfirmActionButton action={deleteInventoryItemPermanently.bind(null,item.id)} label="Delete permanently" title="Delete product permanently?" name={item.barcode??item.article_number??"Product"} message="This cannot be undone. Product history and this product's historical sale footprint will be removed. Sales with other products will be recalculated." danger/>:null}</div>:null}</div><dl className="mt-6 grid gap-px overflow-hidden rounded-xl border bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">{details.map(([label,value]) => <div key={label} className="bg-white p-5"><dt className="text-xs font-medium uppercase text-stone-500">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{value}</dd></div>)}</dl><div className="mt-8 rounded-xl border bg-white p-6"><h2 className="text-lg font-semibold">Product History</h2>{history.length === 0 ? <p className="mt-3 text-sm text-stone-500">No recorded changes.</p> : <ol className="mt-4 divide-y">{history.map(entry => <li key={entry.id} className="py-4"><div className="flex justify-between gap-2"><p className="font-medium">{entry.field_name}</p><time className="text-xs text-stone-500">{formatDateTime(entry.changed_at)}</time></div><p className="mt-1 text-sm">{entry.old_value ?? "—"} → {entry.new_value ?? "—"}</p><p className="mt-1 text-xs text-stone-500">{entry.source.replaceAll("_"," ")} · Changed by {entry.employees?.full_name ?? entry.changed_by_name ?? entry.changed_by_username ?? "System"}</p></li>)}</ol>}</div></section>;
}
