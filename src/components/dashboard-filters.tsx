"use client";

import { useState } from "react";
import { REPORTING_PERIODS, type ReportingPeriod } from "@/lib/dashboard/model";
import { useI18n } from "./i18n-provider";

type Shop = { id: string; name: string };

export function DashboardFilters({ period: initialPeriod, start, end, shopId, shops, isOwner }: {
  period: ReportingPeriod;
  start: string;
  end: string;
  shopId: string;
  shops: Shop[];
  isOwner: boolean;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const { t } = useI18n();
  const periodKeys: Record<ReportingPeriod,string>={TODAY:"today",LAST_7_DAYS:"last7",THIS_MONTH:"thisMonth",LAST_30_DAYS:"last30",CUSTOM:"custom"};

  return <form className="flex w-full flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
    <label className="text-sm font-medium">{t("dashboard.period")}<select name="period" value={period} onChange={(event) => setPeriod(event.target.value as ReportingPeriod)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto">{REPORTING_PERIODS.map((value) => <option key={value} value={value}>{t(`dashboard.${periodKeys[value]}`)}</option>)}</select></label>
    {period === "CUSTOM" ? <>
      <label className="text-sm font-medium">{t("dashboard.from")}<input type="date" name="start" defaultValue={start} required className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto" /></label>
      <label className="text-sm font-medium">{t("dashboard.to")} <span className="font-normal text-stone-500">({t("common.optional")})</span><input type="date" name="end" defaultValue={end} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto" /></label>
    </> : null}
    {isOwner ? <label className="text-sm font-medium">{t("fields.shop")}<select name="shop" defaultValue={shopId} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto"><option value="">{t("dashboard.allShops")}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label> : null}
    <button className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white sm:w-auto">{t("inventory.filters.apply")}</button>
  </form>;
}
