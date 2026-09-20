"use client";

import type { ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(null);
  function show() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(256, window.innerWidth - 24);
    const left = Math.max(12 + width / 2, Math.min(window.innerWidth - 12 - width / 2, rect.left + rect.width / 2));
    setPosition({ left, top: rect.top > 96 ? rect.top - 8 : rect.bottom + 8, below: rect.top <= 96 });
  }
  return <span className="zl-tooltip">
    <button ref={trigger} type="button" aria-label={label} aria-describedby={position ? id : undefined} onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)} className="ml-1 inline-grid h-5 w-5 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" strokeLinecap="round"/></svg>
    </button>
    {position && typeof document !== "undefined" ? createPortal(<span role="tooltip" id={id} data-side={position.below ? "bottom" : "top"} className="zl-tooltip__portal" style={{ left: position.left, top: position.top }}>{children}</span>, document.body) : null}
  </span>;
}
