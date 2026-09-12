import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryForm } from "@/components/inventory-form";
import { updateInventoryItem } from "@/lib/inventory/actions";
import { canManageInventory, getCurrentEmployee, getInventoryItem, getInventoryOptions } from "@/lib/inventory/queries";
import { getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Edit product" };

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getTranslations();
  const { id } = await params;
  const [item, employee] = await Promise.all([getInventoryItem(id), getCurrentEmployee()]);
  if (!canManageInventory(employee.role) || item.status === "SOLD") redirect(`/inventory/${id}`);
  const options = await getInventoryOptions();
  const action = updateInventoryItem.bind(null, id);
  return <section className="max-w-5xl">
    <Link href={`/inventory/${id}`} className="text-sm font-medium text-stone-600 hover:text-stone-900">← {t("inventory.details")}</Link>
    <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("inventory.edit")}</h1>
    <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <InventoryForm action={action} {...options} item={item} categoryName={item.product_categories?.name ?? null} cancelHref={`/inventory/${id}`} />
    </div>
  </section>;
}
