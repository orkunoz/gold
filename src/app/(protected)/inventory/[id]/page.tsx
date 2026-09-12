import Link from "next/link";
import { InventoryStatus } from "@/components/inventory-status";
import { displayValue, formatDateTime, formatPrice } from "@/lib/inventory/format";
import { canManageInventory, getCurrentEmployee, getInventoryHistory, getInventoryItem } from "@/lib/inventory/queries";
import { deleteInventoryItemPermanently } from "@/lib/inventory/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Product details" };

export default async function InventoryItemPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{error?:string}> }) {
  const { id } = await params;
  const { t, locale } = await getTranslations();
  const {error}=await searchParams;
  const [item, employee, history] = await Promise.all([getInventoryItem(id), getCurrentEmployee(), getInventoryHistory(id)]);
  const details = [
    [t("fields.productCategory"), item.product_categories?.name ?? "—"], [t("fields.producer"), displayValue(item.producer)],
    [t("fields.metal"), displayValue(item.metal)], [t("fields.fineness"), displayValue(item.gold_fineness)], [t("fields.size"), displayValue(item.size)],
    [t("fields.weight"), item.weight_grams === null ? "—" : `${item.weight_grams} g`], [t("fields.pricePerGram"), formatPrice(item.price_per_gram,locale)],
    [t("fields.article"), displayValue(item.article_number)], [t("fields.priceUah"), formatPrice(item.price,locale)], [t("fields.notes"), item.notes || "—"],
    [t("fields.status"), t(`status.${item.status}`)], [t("fields.shop"), item.shops?.name ?? t("common.unassigned")], [t("fields.barcode"), displayValue(item.barcode)],
  ];
  const canEdit=canManageInventory(employee.role)&&item.status!=="SOLD";
  return <section className="max-w-5xl"><Link href="/inventory" className="text-sm font-medium text-stone-600">← {t("inventory.title")}</Link>{error?<p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>:null}<div className="mt-6 flex flex-wrap items-center justify-between gap-4"><div><InventoryStatus status={item.status}/>{item.status==="SOLD"?<p className="mt-2 text-sm text-stone-500">{t("inventory.readOnly")}</p>:null}</div>{canEdit?<div className="flex items-center gap-4"><Link href={`/inventory/${item.id}/edit`} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">{t("inventory.edit")}</Link><ConfirmActionButton action={deleteInventoryItemPermanently.bind(null,item.id)} label={t("inventory.deletePermanently")} title={t("inventory.deleteTitle")} name={item.barcode??item.article_number??t("inventory.title")} message={t("inventory.deleteMessage")} danger/></div>:null}</div><dl className="mt-6 grid gap-px overflow-hidden rounded-xl border bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">{details.map(([label,value]) => <div key={label} className="bg-white p-5"><dt className="text-xs font-medium uppercase text-stone-500">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{value}</dd></div>)}</dl><div className="mt-8 rounded-xl border bg-white p-6"><h2 className="text-lg font-semibold">{t("inventory.history")}</h2>{history.length === 0 ? <p className="mt-3 text-sm text-stone-500">{t("inventory.noHistory")}</p> : <ol className="mt-4 divide-y">{history.map(entry => <li key={entry.id} className="py-4"><div className="flex justify-between gap-2"><p className="font-medium">{entry.field_name}</p><time className="text-xs text-stone-500">{formatDateTime(entry.changed_at,locale)}</time></div><p className="mt-1 text-sm">{entry.old_value ?? "—"} → {entry.new_value ?? "—"}</p><p className="mt-1 text-xs text-stone-500">{entry.source.replaceAll("_"," ")} · {t("inventory.historyChangedBy",{name:entry.employees?.full_name ?? entry.changed_by_name ?? entry.changed_by_username ?? t("common.system")})}</p></li>)}</ol>}</div></section>;
}
