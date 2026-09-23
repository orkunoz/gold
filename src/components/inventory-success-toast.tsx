"use client";

import { useEffect, useState, type ReactNode } from "react";

export const INVENTORY_TOAST_VISIBLE_MS = 5000;
export const INVENTORY_TOAST_FADE_MS = 300;

export function InventorySuccessToast({ message, version, children, onDismiss }: { message: string; version: number; children?: ReactNode; onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setVisible(false), INVENTORY_TOAST_VISIBLE_MS);
    const removeTimer = window.setTimeout(onDismiss, INVENTORY_TOAST_VISIBLE_MS + INVENTORY_TOAST_FADE_MS);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(removeTimer); };
  }, [message, version, onDismiss]);
  return <p role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl transition-opacity duration-300 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}>{message}{children}</p>;
}
