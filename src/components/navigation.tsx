"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { EmployeeRole } from "@/lib/database.types";
import { useI18n } from "./i18n-provider";

const links = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/inventory", key: "nav.inventory" },
  { href: "/sales", key: "nav.sales" },
];

export function navigationLinks(role: EmployeeRole) {
  return role === "owner" ? [...links, { href: "/documents", key: "documents.title" }, { href: "/admin", key: "nav.administration" }] : links;
}

export function Navigation({ role }: { role: EmployeeRole }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const visibleLinks = navigationLinks(role);
  return <nav aria-label={t("nav.main")} className="flex items-center justify-end gap-1 overflow-x-auto py-2">
    <div className="flex items-center gap-1">{visibleLinks.map(({ href, key }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`) || (href==="/documents"&&pathname.startsWith("/transfers/"));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${active ? "text-stone-950 after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-amber-700" : "text-stone-500 hover:bg-stone-50 hover:text-stone-950"}`}>{t(key)}<NavigationPending /></Link>;
    })}</div>
    <Link href="/sell" aria-current={pathname.startsWith("/sell") ? "page" : undefined} className="sell-cta ml-2 inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition duration-150 active:scale-[.98]">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M6 6l1 13h10l1-13M9 10v5M15 10v5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {t("nav.sell")}<NavigationPending />
    </Link>
  </nav>;
}

function NavigationPending() {
  const { pending } = useLinkStatus();
  const { t } = useI18n();
  return pending ? <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-label={t("nav.loadingPage")} /> : null;
}
