"use client";

import { forwardRef, useEffect, useState, type HTMLAttributes, type ReactNode } from "react";

export const PopoverSurface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { open: boolean; children: ReactNode }>(function PopoverSurface({ open, className = "", children, ...props }, ref) {
  const [hasOpened, setHasOpened] = useState(open);
  useEffect(() => { if (open) setHasOpened(true); }, [open]);
  return <div ref={ref}
    {...props}
    data-state={open ? "open" : hasOpened ? "closed" : "idle"}
    aria-hidden={!open}
    inert={!open}
    className={`zl-popover-surface ${className}`}
  >{children}</div>;
});
