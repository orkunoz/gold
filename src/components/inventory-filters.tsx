"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { EmployeeRole, InventoryStatus } from "@/lib/database.types";
import { INVENTORY_FILTER_DEBOUNCE_MS, inventoryHref } from "@/lib/inventory/filter-url";
import type { InventoryFilters } from "@/lib/inventory/queries";
import { locationDisplayName } from "@/lib/locations/display";
import { useI18n } from "./i18n-provider";
import { CameraBarcodeScanner } from "./camera-barcode-scanner";
import {positiveInventoryWeight} from "@/lib/inventory/weight-filter";

type Option = { id: string; name: string; location_type?: string | null };

export function InventoryFilters({ filters, role, categories, producers, sizes, shops, children }: {
  filters: InventoryFilters;
  role: EmployeeRole;
  categories: Option[];
  producers: string[];
  sizes: string[];
  shops: Option[];
  children: ReactNode;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState({ barcode: filters.barcode ?? "", article: filters.article ?? "", weight: filters.weight ?? "" });
  const [isPending, startTransition] = useTransition();
  const initialized = useRef(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      if (draft.weight && positiveInventoryWeight(draft.weight)===null) return;
      const href = inventoryHref(searchParams.toString(), draft, pathname);
      const current = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
      if (href !== current) startTransition(() => router.push(href, { scroll: false }));
    }, INVENTORY_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, pathname, router, searchParams]);

  function applySelect(name: string, value: string) {
    startTransition(() => router.push(inventoryHref(searchParams.toString(), { [name]: value }, pathname), { scroll: false }));
  }
  function applyScannedBarcode(value: string) {
    setDraft((current) => ({ ...current, barcode: value }));
    startTransition(() => router.push(inventoryHref(searchParams.toString(), { barcode: value }, pathname), { scroll: false }));
  }

  const control = "zl-control mt-1.5 h-10 w-full min-w-0 bg-white px-2.5";
  return <><form onSubmit={(event) => event.preventDefault()} className="zl-surface mt-5 px-4 py-3">
    <div className={`zl-inventory-filters-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 ${role === "owner" ? "zl-inventory-filters-grid--owner" : "zl-inventory-filters-grid--sales"}`}>
      <label className="min-w-0 text-xs font-medium">{t("fields.barcode")}<span className="mt-1.5 flex gap-1.5"><input ref={barcodeRef} name="barcode" value={draft.barcode} onChange={(event) => setDraft((current) => ({ ...current, barcode: event.target.value }))} className="zl-control h-10 min-w-0 flex-1 px-2.5" /><CameraBarcodeScanner returnFocus={barcodeRef} onDetected={applyScannedBarcode}/></span></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.article")}<input name="article" value={draft.article} onChange={(event) => setDraft((current) => ({ ...current, article: event.target.value }))} className={control} /></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.producer")}<select name="producer" value={filters.producer ?? ""} onChange={(event) => applySelect("producer", event.target.value)} className={control}><option value="">{locale==="ua"?t("common.all"):t("inventory.filters.allProducers")}</option>{producers.map(producer=><option key={producer} value={producer}>{producer}</option>)}</select></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.size")}<select name="size" value={filters.size ?? ""} onChange={(event) => applySelect("size", event.target.value)} className={control}><option value="">{locale==="ua"?t("common.all"):t("inventory.filters.allSizes")}</option>{sizes.map(size=><option key={size} value={size}>{size}</option>)}</select></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.weight")}<input name="weight" type="number" min="0" step="any" inputMode="decimal" value={draft.weight} onChange={(event)=>setDraft(current=>({...current,weight:event.target.value}))} className={control}/></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.createdDate")}<input name="createdDate" type="date" value={filters.createdDate ?? ""} onChange={(event) => applySelect("createdDate", event.target.value)} className={control} /></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.productCategory")}<select name="category" value={filters.category ?? ""} onChange={(event) => applySelect("category", event.target.value)} className={control}><option value="">{locale==="ua"?t("common.all"):t("inventory.filters.allCategories")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="min-w-0 text-xs font-medium">{t("fields.status")}<select name="status" value={filters.status ?? "IN_STOCK"} onChange={(event) => applySelect("status", event.target.value)} className={control}><option value="ALL">{t("inventory.filters.allStatuses")}</option>{(["IN_STOCK", "SOLD"] as InventoryStatus[]).map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}</select></label>
      {role === "owner" ? <label className="min-w-0 text-xs font-medium">{t("fields.shop")}<select name="shop" value={filters.shop ?? ""} onChange={(event) => applySelect("shop", event.target.value)} className={control}><option value="">{locale==="ua"?t("common.all"):t("inventory.filters.allShops")}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{locationDisplayName(shop,locale)}</option>)}</select></label> : null}
    </div>
    <div className="mt-1.5 flex min-h-7 items-center gap-3"><Link href="/inventory" scroll={false} className="rounded px-1.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800">{t("inventory.filters.clear")}</Link>{isPending ? <span role="status" className="text-xs text-stone-500">{t("common.loading")}</span> : null}</div>
  </form><div aria-busy={isPending} className="relative">
    <div className={isPending ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>{children}</div>
    {isPending ? <div className="absolute inset-x-0 top-6 h-64 animate-pulse rounded-xl border border-stone-200 bg-stone-100/80" aria-hidden="true" /> : null}
  </div></>;
}
