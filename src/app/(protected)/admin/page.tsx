import Link from "next/link";
import { getTranslations } from "@/lib/i18n/server";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const {t}=await getTranslations();
  return <section>
    <PageHeading title={t("admin.title")} />
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <Link href="/admin/employees" className="zl-surface p-6 transition duration-150 hover:border-amber-700 hover:shadow-md"><h2 className="zl-card-title">{t("admin.accounts")}</h2></Link>
      <Link href="/admin/shops" className="zl-surface p-6 transition duration-150 hover:border-amber-700 hover:shadow-md"><h2 className="zl-card-title">{t("admin.shops")}</h2></Link>
    </div>
  </section>;
}
