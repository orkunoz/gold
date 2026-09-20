"use client";

import { useMemo, useState } from "react";
import { useI18n } from "./i18n-provider";

const iso = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const parse = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day)); };

export function DateRangeCalendar({ start, end, max, onComplete }: { start: string; end: string; max: string; onComplete: (start: string, end: string) => void }) {
  const { locale, t } = useI18n();
  const initial = start ? parse(start) : parse(max);
  const [month, setMonth] = useState(new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)));
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const tag = locale === "ua" ? "uk-UA" : "en-US";
  const days = useMemo(() => {
    const firstWeekday = (month.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: count }, (_, index) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index + 1)))];
  }, [month]);
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, index + 1))));

  function select(value: string) {
    if (!draftStart || draftEnd) { setDraftStart(value); setDraftEnd(""); return; }
    const ordered: [string, string] = value < draftStart ? [value, draftStart] : [draftStart, value];
    setDraftStart(ordered[0]); setDraftEnd(ordered[1]); onComplete(ordered[0], ordered[1]);
  }

  const monthAfterMax = month.getUTCFullYear() > parse(max).getUTCFullYear() || (month.getUTCFullYear() === parse(max).getUTCFullYear() && month.getUTCMonth() >= parse(max).getUTCMonth());
  return <div className="w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-3 shadow-xl" aria-label={t("dashboard.customRange")}>
    <div className="flex items-center justify-between px-1"><button type="button" className="icon-button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} aria-label={t("dashboard.previousMonth")}>‹</button><strong className="text-sm font-semibold capitalize text-stone-900">{new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(month)}</strong><button type="button" className="icon-button" disabled={monthAfterMax} onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} aria-label={t("dashboard.nextMonth")}>›</button></div>
    <div className="mt-3 grid grid-cols-7 text-center text-xs text-stone-500">{weekdays.map((day, index) => <span key={`${day}-${index}`} className="py-1">{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-y-0.5">{days.map((date, index) => date ? (() => {
      const value = iso(date); const disabled = value > max; const inRange = Boolean(draftStart && value >= draftStart && value <= (draftEnd || draftStart)); const edge = value === draftStart || value === draftEnd;
      return <button key={value} type="button" disabled={disabled} onClick={() => select(value)} aria-pressed={inRange} className={`h-9 text-sm transition ${edge ? "rounded-lg bg-amber-800 font-semibold text-amber-50" : inRange ? "bg-amber-50 text-amber-950" : "rounded-lg text-stone-700 hover:bg-stone-50"} disabled:cursor-not-allowed disabled:opacity-30`}>{date.getUTCDate()}</button>;
    })() : <span key={`blank-${index}`} />)}</div>
    <p className="mt-3 border-t border-stone-200 pt-2 text-xs text-stone-500">{draftStart ? draftEnd ? t("dashboard.rangeSelected") : t("dashboard.selectEnd") : t("dashboard.selectStart")}</p>
  </div>;
}
