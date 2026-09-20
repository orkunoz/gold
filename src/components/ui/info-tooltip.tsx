"use client";

import type { ReactNode } from "react";
import { useId } from "react";

export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <span className="zl-tooltip">
    <button type="button" aria-label={label} aria-describedby={id} className="ml-1 inline-grid h-5 w-5 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" strokeLinecap="round"/></svg>
    </button>
    <span role="tooltip" id={id} className="zl-tooltip__content">{children}</span>
  </span>;
}
