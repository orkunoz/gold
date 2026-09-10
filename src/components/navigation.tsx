"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EmployeeRole } from "@/lib/database.types";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sales", label: "Sales" },
];

export function navigationLinks(role: EmployeeRole) {
  return role === "owner" ? [...links, { href: "/admin", label: "Administration" }] : links;
}

export function Navigation({ role }: { role: EmployeeRole }) {
  const pathname = usePathname();
  const visibleLinks = navigationLinks(role);
  return <nav aria-label="Main navigation" className="flex gap-2 overflow-x-auto">
    {visibleLinks.map(({ href, label }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{label}</Link>;
    })}
  </nav>;
}
