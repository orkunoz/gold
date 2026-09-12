import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryImport } from "@/components/inventory-import";
import { canManageInventory, getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
import { getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Import inventory" };

export default async function ImportInventoryPage() {
  const { t } = await getTranslations();
  const [employee, options] = await Promise.all([getCurrentEmployee(), getInventoryOptions()]);
  if (!canManageInventory(employee.role)) redirect("/inventory");
  return <section className="max-w-6xl"><Link href="/inventory" className="text-sm font-medium text-stone-600 hover:text-stone-900">← {t("inventory.title")}</Link><h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("inventory.import")}</h1><div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><InventoryImport employeeShopId={employee.shop_id} shops={options.shops} /></div></section>;
}
