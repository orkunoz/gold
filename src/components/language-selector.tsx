"use client";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/core";
import { useI18n } from "./i18n-provider";

export function LanguageSelector() {
  const { locale, t } = useI18n(); const router = useRouter();
  async function select(next: Locale) { await fetch("/api/language",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale:next})}); router.refresh(); }
  return <div aria-label={t("language.selector")} className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs font-semibold">
    {(["ua", "en"] as const).map((code) => <button key={code} type="button" onClick={() => void select(code)} aria-pressed={locale === code} className={`rounded-md px-1.5 py-1 ${locale === code ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}>{t(`language.${code}`)}</button>)}
  </div>;
}
