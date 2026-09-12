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
  return role === "owner" ? [...links, { href: "/admin", key: "nav.administration" }] : links;
}

export function Navigation({ role }: { role: EmployeeRole }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const visibleLinks = navigationLinks(role);
  return <nav aria-label={t("nav.main")} className="flex gap-2 overflow-x-auto">
    {visibleLinks.map(({ href, key }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${active ? "bg-amber-950 text-amber-50 shadow-sm" : "text-stone-600 hover:bg-amber-50 hover:text-amber-950"}`}>{t(key)}<NavigationPending /></Link>;
    })}
  </nav>;
}

function NavigationPending() {
  const { pending } = useLinkStatus();
  const { t } = useI18n();
  return pending ? <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-label={t("nav.loadingPage")} /> : null;
}
