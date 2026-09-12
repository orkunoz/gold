import { requireUser } from "@/lib/auth/session";
import Image from "next/image";
import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { LanguageSelector } from "@/components/language-selector";
import { getTranslations } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const [claims, employee, { t }] = await Promise.all([requireUser(), getCurrentEmployee(), getTranslations()]);
  const shopName=employee.shops?.name;
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-4">{t("nav.skip")}</a>
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3"><Image src="/zlata-logo.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" /><span className="text-lg font-semibold tracking-[0.2em] text-amber-900">ZLATA</span></div>
        <div className="flex items-center gap-4">
          <LanguageSelector />
          <span className="hidden max-w-64 text-right text-sm sm:block"><strong className="block truncate text-stone-800">{employee.username || employee.full_name || (typeof claims.email === "string" ? claims.email : t("auth.teamMember"))}</strong><span className="text-xs text-stone-500">{employee.role==="owner"?t("auth.ownerAllShops"):shopName??t("auth.assignedShop")}</span></span>
          <SignOutButton />
        </div>
        <div className="w-full"><Navigation role={employee.role} /></div>
      </div>
    </header>
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
  </>;
}
