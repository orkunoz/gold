"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "./sign-out-button";
import { PopoverSurface } from "./ui/popover-surface";

export function AccountMenu({ username, roleLabel, shopName }: { username: string; roleLabel: string; shopName: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <div ref={root} className="relative" onKeyDown={(event) => { if (event.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" aria-label={username} onClick={() => setOpen(value => !value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>("button")?.focus()); } }} aria-expanded={open} aria-haspopup="menu" className="flex max-w-48 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-medium text-stone-800 transition duration-150 hover:bg-stone-50">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-stone-200 bg-stone-50 text-stone-600" aria-hidden="true"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 20c.7-4 2.9-6 6.5-6s5.8 2 6.5 6" strokeLinecap="round"/></svg></span>
      <span className="account-menu__label truncate">{username}</span><span aria-hidden="true" className={`account-menu__label text-xs text-stone-400 transition duration-150 ${open ? "rotate-180" : ""}`}>⌄</span>
    </button>
    <PopoverSurface ref={menu} open={open} role="menu" className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-56 origin-top-right rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
      <div className="px-2.5 py-2"><p className="truncate text-sm font-semibold text-stone-900">{username}</p><p className="mt-0.5 text-xs text-stone-500">{roleLabel}{shopName ? ` · ${shopName}` : ""}</p></div>
      <div className="my-1 border-t border-stone-200" />
      <SignOutButton compact />
    </PopoverSurface>
  </div>;
}
