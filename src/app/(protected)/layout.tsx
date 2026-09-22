import Image from "next/image";
import Link from "next/link";
import { Navigation, SellLink } from "@/components/navigation";
import { AccountMenu } from "@/components/account-menu";
import { getCurrentEmployee, getShopName } from "@/lib/inventory/queries";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTranslations } from "@/lib/i18n/server";
import { locationDisplayName } from "@/lib/locations/display";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const [employee, { t, locale }] = await Promise.all([getCurrentEmployee(), getTranslations()]);
  const rawShopName=employee.role === "salesperson" && employee.shop_id ? await getShopName(employee.shop_id) : null;
  const shopName=rawShopName ? locationDisplayName({ name: rawShopName },locale) : null;
  return <>
    <header className="app-header border-b border-stone-200 bg-white">
      <div className="zl-app-container app-header__row flex min-h-16 items-center gap-5">
        <Link href="/dashboard" aria-label={`${t("dashboard.title")} — Zlata Jewelry`} className="flex shrink-0 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><Image src="/logoZlataBrown.png" alt="" width={626} height={405} className="zl-brand-logo h-10 w-auto object-contain sm:h-11" priority /></Link>
        <div className="app-header__nav-slot min-w-0"><Navigation role={employee.role} /></div>
        <div className="app-header__utilities ml-auto flex shrink-0 items-center gap-1.5">
          <SellLink />
          <LanguageSelector />
          <ThemeToggle />
          <AccountMenu username={employee.username || employee.full_name || t("auth.teamMember")} roleLabel={employee.role === "owner" ? t("auth.owner") : t("auth.salesperson")} shopName={shopName} />
        </div>
      </div>
    </header>
    <main id="main-content" className="zl-app-container py-6 sm:py-8">{children}</main>
  </>;
}
