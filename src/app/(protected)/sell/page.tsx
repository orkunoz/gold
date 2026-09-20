import { getTranslations } from "@/lib/i18n/server";
import { SalesCheckout } from "@/components/sales-checkout";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";

export async function generateMetadata() { const { t } = await getTranslations(); return { title: t("sales.sellTitle") }; }

export default async function SellPage() {
  const [{ t }, employee] = await Promise.all([getTranslations(), getCurrentEmployee()]);
  const shops = employee.role === "owner" ? await getActiveShops() : [];
  return <section><div className="mb-6 border-b border-stone-200 pb-5"><p className="eyebrow">Zlata</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">{t("sales.sellTitle")}</h1></div><SalesCheckout employee={employee} shops={shops} /></section>;
}
