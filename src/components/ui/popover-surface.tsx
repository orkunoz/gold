"use client";

import { forwardRef, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

export const PopoverSurface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { open: boolean; children: ReactNode }>(function PopoverSurface({ open, className = "", children, ...props }, ref) {
  const [state, setState] = useState<"idle" | "open" | "closing">(open ? "open" : "idle");
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    let frame = 0;
    let timeout = 0;
    if (open) frame = requestAnimationFrame(() => setState("open"));
    else if (stateRef.current !== "idle") {
      setState("closing");
      timeout = window.setTimeout(() => setState("idle"), 160);
    }
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timeout); };
  }, [open]);
  return <div ref={ref}
    {...props}
    data-state={state}
    aria-hidden={!open}
    inert={!open}
    className={`zl-popover-surface ${className}`}
  >{children}</div>;
});
