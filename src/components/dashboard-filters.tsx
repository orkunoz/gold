"use client";

import { FormEvent, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { REPORTING_PERIODS, type ReportingPeriod } from "@/lib/dashboard/model";
import { useI18n } from "./i18n-provider";

type Shop = { id: string; name: string };

export function DashboardFilters({ period: initialPeriod, start: initialStart, end: initialEnd, shopId: initialShopId, shops, isOwner }: {
  period: ReportingPeriod; start: string; end: string; shopId: string; shops: Shop[]; isOwner: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState(initialPeriod);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [shopId, setShopId] = useState(initialShopId);
  const { t } = useI18n();
  const periodKeys: Record<ReportingPeriod,string>={TODAY:"today",LAST_7_DAYS:"last7",THIS_MONTH:"thisMonth",LAST_30_DAYS:"last30",CUSTOM:"custom"};

  function navigate(nextPeriod: ReportingPeriod, nextShopId: string, nextStart = start, nextEnd = end) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", nextPeriod);
    if (nextShopId) params.set("shop", nextShopId); else params.delete("shop");
    if (nextPeriod === "CUSTOM") {
      if (nextStart) params.set("start", nextStart); else params.delete("start");
      if (nextEnd) params.set("end", nextEnd); else params.delete("end");
    } else { params.delete("start"); params.delete("end"); }
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function changePeriod(value: ReportingPeriod) { setPeriod(value); if (value !== "CUSTOM") navigate(value, shopId); }
  function changeShop(value: string) { setShopId(value); if (period !== "CUSTOM" || start) navigate(period, value); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); navigate(period, shopId, start, end); }

  const control = "mt-1 block h-9 w-full rounded-md border border-stone-300 bg-white px-2.5 text-sm text-stone-800 shadow-sm focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700 sm:w-auto";
  return <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end" aria-busy={isPending}>
    <label className="text-xs font-medium text-stone-600">{t("dashboard.period")}<select name="period" value={period} onChange={(event) => changePeriod(event.target.value as ReportingPeriod)} className={control}>{REPORTING_PERIODS.map((value) => <option key={value} value={value}>{t(`dashboard.${periodKeys[value]}`)}</option>)}</select></label>
    {period === "CUSTOM" ? <><label className="text-xs font-medium text-stone-600">{t("dashboard.from")}<input type="date" name="start" value={start} onChange={(event) => setStart(event.target.value)} required className={control} /></label><label className="text-xs font-medium text-stone-600">{t("dashboard.to")} <span className="font-normal text-stone-400">({t("common.optional")})</span><input type="date" name="end" value={end} onChange={(event) => setEnd(event.target.value)} className={control} /></label></> : null}
    {isOwner ? <label className="text-xs font-medium text-stone-600">{t("fields.shop")}<select name="shop" value={shopId} onChange={(event) => changeShop(event.target.value)} className={control}><option value="">{t("dashboard.allShops")}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label> : null}
    <button type="submit" disabled={isPending} className="h-9 w-full rounded-md bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isPending ? t("common.loading") : t("dashboard.apply")}</button>
  </form>;
}
