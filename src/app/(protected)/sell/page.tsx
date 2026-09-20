import { getTranslations } from "@/lib/i18n/server";
import { SalesCheckout } from "@/components/sales-checkout";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";
import { PageHeading } from "@/components/ui/page-heading";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("sales.sellTitle") }; }

export default async function SellPage() {
  const [{ t }, employee] = await Promise.all([getTranslations(), getCurrentEmployee()]);
  const shops = employee.role === "owner" ? await getActiveShops() : [];
  return <section><PageHeading title={t("sales.sellTitle")} /><div className="mt-6"><SalesCheckout employee={employee} shops={shops} /></div></section>;
}
