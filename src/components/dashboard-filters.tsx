"use client";

import { useState } from "react";
import { PERIOD_LABELS, REPORTING_PERIODS, type ReportingPeriod } from "@/lib/dashboard/model";

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

  return <form className="flex w-full flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
    <label className="text-sm font-medium">Period<select name="period" value={period} onChange={(event) => setPeriod(event.target.value as ReportingPeriod)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto">{REPORTING_PERIODS.map((value) => <option key={value} value={value}>{PERIOD_LABELS[value]}</option>)}</select></label>
    {period === "CUSTOM" ? <>
      <label className="text-sm font-medium">Start date<input type="date" name="start" defaultValue={start} required className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto" /></label>
      <label className="text-sm font-medium">End date <span className="font-normal text-stone-500">(optional)</span><input type="date" name="end" defaultValue={end} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto" /></label>
    </> : null}
    {isOwner ? <label className="text-sm font-medium">Shop<select name="shop" defaultValue={shopId} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 sm:w-auto"><option value="">All shops</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label> : null}
    <button className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white sm:w-auto">Apply</button>
  </form>;
}
