import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShops } from "@/lib/admin/queries";
import { deleteShop } from "@/lib/admin/actions";
import { getTranslations } from "@/lib/i18n/server";
import { locationDisplayName } from "@/lib/locations/display";
import { PageHeading } from "@/components/ui/page-heading";
import { buttonStyles } from "@/components/ui/button";

export const metadata = { title: "Shop administration" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const {t,locale}=await getTranslations();
  const [shops, { error }] = await Promise.all([getAdminShops(), searchParams]);
  return <section><Link href="/admin" className="text-sm text-stone-600">← {t("admin.title")}</Link><div className="mt-5"><PageHeading title={t("admin.shops")} actions={<Link href="/admin/shops/new" className={buttonStyles("primary")}>{t("admin.createShop")}</Link>} /></div>{error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p> : null}<div className="zl-table-wrap mt-6"><table className="zl-table min-w-[640px]"><thead><tr>{[t("fields.shop"),t("fields.status"),t("admin.accountsCount"),t("admin.productsCount"),t("common.actions")].map(heading => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{shops.map(shop => <tr key={shop.id}><td className="font-medium">{locationDisplayName(shop,locale)}</td><td>{shop.is_active ? t("common.active") : t("common.inactive")}</td><td>{shop.employee_count}</td><td>{shop.in_stock_count}</td><td><div className="flex gap-3"><Link href={`/admin/shops/${shop.id}/edit`} className="font-medium hover:underline">{t("common.edit")}</Link><ConfirmActionButton action={deleteShop.bind(null,shop.id)} label={t("common.delete")} title={t("admin.deleteShopTitle")} name={locationDisplayName(shop,locale)??shop.name} message={t("admin.deleteShopMessage")} danger /></div></td></tr>)}</tbody></table></div></section>;
}
