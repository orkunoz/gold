"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { EmployeeRole, InventoryStatus } from "@/lib/database.types";
import { INVENTORY_FILTER_DEBOUNCE_MS, inventoryHref } from "@/lib/inventory/filter-url";
import type { InventoryFilters } from "@/lib/inventory/queries";
import { useI18n } from "./i18n-provider";

type Option = { id: string; name: string };

export function InventoryFilters({ filters, role, categories, shops, children }: {
  filters: InventoryFilters;
  role: EmployeeRole;
  categories: Option[];
  shops: Option[];
  children: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState({ barcode: filters.barcode ?? "", article: filters.article ?? "", search: filters.search ?? "" });
  const [isPending, startTransition] = useTransition();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      const href = inventoryHref(searchParams.toString(), draft, pathname);
      const current = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
      if (href !== current) startTransition(() => router.push(href, { scroll: false }));
    }, INVENTORY_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, pathname, router, searchParams]);

  function applySelect(name: string, value: string) {
    startTransition(() => router.push(inventoryHref(searchParams.toString(), { [name]: value }, pathname), { scroll: false }));
  }

  return <><form onSubmit={(event) => event.preventDefault()} className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium">{t("fields.barcode")}<input name="barcode" value={draft.barcode} onChange={(event) => setDraft((current) => ({ ...current, barcode: event.target.value }))} placeholder={t("inventory.filters.barcode")} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" /></label>
      <label className="text-sm font-medium">{t("fields.article")}<input name="article" value={draft.article} onChange={(event) => setDraft((current) => ({ ...current, article: event.target.value }))} placeholder={t("inventory.filters.article")} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" /></label>
      <label className="text-sm font-medium">{t("fields.productCategory")}<select name="category" value={filters.category ?? ""} onChange={(event) => applySelect("category", event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">{t("inventory.filters.allCategories")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="text-sm font-medium">{t("fields.status")}<select name="status" value={filters.status ?? ""} onChange={(event) => applySelect("status", event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">{t("inventory.filters.allStatuses")}</option>{(["IN_STOCK", "SOLD"] as InventoryStatus[]).map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}</select></label>
      {role === "owner" ? <label className="text-sm font-medium">{t("fields.shop")}<select name="shop" value={filters.shop ?? ""} onChange={(event) => applySelect("shop", event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">{t("inventory.filters.allShops")}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label> : null}
      <label className="text-sm font-medium lg:col-span-2">{t("common.search")}<input name="search" value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder={t("inventory.filters.text")} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" /></label>
    </div>
    <div className="mt-5 flex min-h-9 items-center gap-3"><Link href="/inventory" scroll={false} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">{t("inventory.filters.clear")}</Link>{isPending ? <span role="status" className="text-sm text-stone-500">{t("common.loading")}</span> : null}</div>
  </form><div aria-busy={isPending} className="relative">
    <div className={isPending ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>{children}</div>
    {isPending ? <div className="absolute inset-x-0 top-6 h-64 animate-pulse rounded-xl border border-stone-200 bg-stone-100/80" aria-hidden="true" /> : null}
  </div></>;
}
