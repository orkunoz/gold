"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/inventory/format";
import { localeTag, type Locale } from "@/lib/i18n/core";

export function MetricCountUp({ value, locale, kind = "price", suffix = "" }: { value: number; locale: Locale; kind?: "price" | "number" | "weight"; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return;
    let frame = 0;
    const started = performance.now();
    const duration = 650;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick); else setDisplay(value);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const output = kind === "price" ? formatPrice(display, locale) : `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: kind === "weight" ? 3 : 0 }).format(display)}${suffix}`;
  return <span className="zl-tabular" aria-label={kind === "price" ? formatPrice(value, locale) : `${value}${suffix}`}>{output}</span>;
}
