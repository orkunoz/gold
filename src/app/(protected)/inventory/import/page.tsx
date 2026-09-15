import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryImport } from "@/components/inventory-import";
import { canManageInventory, getActiveLocations, getCurrentEmployee } from "@/lib/inventory/queries";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("inventory.import") }; }

export default async function ImportInventoryPage() {
  const { t } = await getTranslations();
  const [employee, locations] = await Promise.all([getCurrentEmployee(), getActiveLocations()]);
  if (!canManageInventory(employee.role)) redirect("/inventory");
  const warehouse=locations.find(location=>location.location_type==="WAREHOUSE");
  if(!warehouse)return <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{t("import.messages.warehouseMissing")}</p>;
  return <section className="w-full"><Link href="/inventory" className="text-sm font-medium text-stone-600 hover:text-stone-900">← {t("inventory.title")}</Link><h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("inventory.import")}</h1><div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><InventoryImport employeeShopId={warehouse.id} shops={[warehouse]} /></div></section>;
}
