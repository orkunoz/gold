import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryDraftBasket } from "@/components/inventory-draft-basket";
import { canManageInventory, getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
import { getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Add product" };

export default async function NewInventoryItemPage() {
  const { t } = await getTranslations();
  const [employee, options] = await Promise.all([getCurrentEmployee(), getInventoryOptions()]);
  if (!canManageInventory(employee.role)) redirect("/inventory");
  const warehouse = options.shops.find(shop => shop.location_type === "WAREHOUSE") ?? null;
  return <section>
    <Link href="/inventory" className="text-sm font-medium text-stone-600 hover:text-stone-900">← {t("inventory.title")}</Link>
    <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("inventory.add")}</h1>
    <div className="mt-6"><InventoryDraftBasket categories={options.categories} producers={options.producers} sizes={options.sizes} locations={options.shops} warehouse={warehouse}/></div>
  </section>;
}
