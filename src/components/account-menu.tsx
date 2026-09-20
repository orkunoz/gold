"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "./sign-out-button";

export function AccountMenu({ username, roleLabel, shopName }: { username: string; roleLabel: string; shopName: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <div ref={root} className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu" className="flex max-w-44 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-stone-800 transition hover:bg-stone-50">
      <span className="truncate">{username}</span><span aria-hidden="true" className={`text-xs text-stone-400 transition ${open ? "rotate-180" : ""}`}>⌄</span>
    </button>
    {open ? <div role="menu" className="absolute left-0 top-[calc(100%+.5rem)] z-50 w-52 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
      <div className="px-2.5 py-2"><p className="truncate text-sm font-semibold text-stone-900">{username}</p><p className="mt-0.5 text-xs text-stone-500">{roleLabel}{shopName ? ` · ${shopName}` : ""}</p></div>
      <div className="my-1 border-t border-stone-200" />
      <SignOutButton compact />
    </div> : null}
  </div>;
}
