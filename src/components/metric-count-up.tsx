"use client";

import { useEffect, useState } from "react";
import { formatDashboardPrice } from "@/lib/inventory/format";
import { localeTag, type Locale } from "@/lib/i18n/core";

export const METRIC_COUNT_UP_DURATION = 650;

export function metricCountUpFrame(target: number, elapsedMs: number, reducedMotion = false) {
  if (reducedMotion || elapsedMs >= METRIC_COUNT_UP_DURATION) return target;
  const progress = Math.min(1, Math.max(0, elapsedMs / METRIC_COUNT_UP_DURATION));
  return target * (1 - Math.pow(1 - progress, 3));
}

export function metricMaximumFractionDigits(kind: "price" | "number" | "weight", target: number) {
  return kind === "weight" && !Number.isInteger(target) ? 3 : 0;
}

export function MetricCountUp({ value, locale, kind = "price", suffix = "" }: { value: number; locale: Locale; kind?: "price" | "number" | "weight"; suffix?: string }) {
  const [animation, setAnimation] = useState({ target: value, display: 0 });
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    if (reducedMotion || value === 0) {
      frame = requestAnimationFrame(() => setAnimation({ target: value, display: value }));
      return () => cancelAnimationFrame(frame);
    }
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = now - started;
      setAnimation({ target: value, display: metricCountUpFrame(value, elapsed) });
      if (elapsed < METRIC_COUNT_UP_DURATION) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const display = animation.target === value ? animation.display : 0;
  const format = (number: number) => kind === "price" ? formatDashboardPrice(number, locale) : `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: metricMaximumFractionDigits(kind, value) }).format(number)}${suffix}`;
  return <span className="zl-tabular" aria-label={format(value)}>{format(display)}</span>;
}
