import { getTranslations } from "@/lib/i18n/server";
import { SalesCheckout } from "@/components/sales-checkout";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("sales.title") }; }

export default async function SalesPage() {
  const employee = await getCurrentEmployee();
  const shops = employee.role === "owner" ? await getActiveShops() : [];
  return <section><SalesCheckout employee={employee} shops={shops} /></section>;
}
