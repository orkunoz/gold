"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDashboardRange, REPORTING_PERIODS, type ReportingPeriod } from "@/lib/dashboard/model";
import { useI18n } from "./i18n-provider";
import { locationDisplayName } from "@/lib/locations/display";
import { DateRangeCalendar } from "./date-range-calendar";

type Shop = { id: string; name: string; location_type?: string | null };

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
  const [calendarOpen, setCalendarOpen] = useState(initialPeriod === "CUSTOM" && !initialStart);
  const calendarRoot = useRef<HTMLDivElement>(null);
  const { t, locale } = useI18n();
  const periodKeys: Record<ReportingPeriod,string>={TODAY:"today",LAST_7_DAYS:"last7",LAST_30_DAYS:"last30",THIS_MONTH:"thisMonth",LAST_MONTH:"lastMonth",ALL_TIME:"allTime",CUSTOM:"custom"};
  const todayParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;

  useEffect(() => { function close(event: PointerEvent) { if (!calendarRoot.current?.contains(event.target as Node)) setCalendarOpen(false); } document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);

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

  function changePeriod(value: ReportingPeriod) { setPeriod(value); if (value === "CUSTOM") setCalendarOpen(true); else { setCalendarOpen(false); navigate(value, shopId); } }
  function changeShop(value: string) { setShopId(value); if (period !== "CUSTOM" || start) navigate(period, value); }
  function completeRange(nextStart: string, nextEnd: string) { setStart(nextStart); setEnd(nextEnd); setCalendarOpen(false); navigate("CUSTOM", shopId, nextStart, nextEnd); }

  const control = "zl-control h-10 bg-white px-3 text-stone-800 shadow-sm focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700";
  return <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto" aria-busy={isPending}>
    {isOwner ? <label className="sr-only" htmlFor="dashboard-shop">{t("fields.shop")}</label> : null}
    {isOwner ? <select id="dashboard-shop" name="shop" value={shopId} onChange={(event) => changeShop(event.target.value)} className={control}><option value="">{t("dashboard.allShops")}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{locationDisplayName(shop,locale)}</option>)}</select> : null}
    <div ref={calendarRoot} className="relative">
      <label className="sr-only" htmlFor="dashboard-period">{t("dashboard.period")}</label>
      <select id="dashboard-period" name="period" value={period} onChange={(event) => changePeriod(event.target.value as ReportingPeriod)} className={`${control} min-w-40 pr-8`}>{REPORTING_PERIODS.map((value) => <option key={value} value={value}>{value === "CUSTOM" && start ? formatDashboardRange(start, end || start, locale) : t(`dashboard.${periodKeys[value]}`)}</option>)}</select>
      {period === "CUSTOM" ? <button type="button" onClick={() => setCalendarOpen(value => !value)} className="absolute inset-y-0 right-7 w-8" aria-label={t("dashboard.openCalendar")}><svg aria-hidden="true" viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor"><path d="M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg></button> : null}
      {calendarOpen ? <div className="absolute right-0 top-[calc(100%+.5rem)] z-40"><DateRangeCalendar start={start} end={end} max={today} onComplete={completeRange} /></div> : null}
    </div>
    {isPending ? <span className="text-xs text-stone-500" role="status">{t("common.loading")}</span> : null}
  </div>;
}
