import Link from "next/link";
import { getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const {t}=await getTranslations();
  return <section>
    <div className="grid gap-5 sm:grid-cols-2">
      <Link href="/admin/employees" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">{t("admin.accounts")}</h2></Link>
      <Link href="/admin/shops" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">{t("admin.shops")}</h2></Link>
    </div>
  </section>;
}
