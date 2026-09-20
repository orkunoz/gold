import type { ReactNode } from "react";

type Tone = "success" | "error" | "warning" | "info";
const styles: Record<Tone, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  error: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  info: "border-sky-300 bg-sky-50 text-sky-900",
};

export function StatusAlert({ tone, title, children }: { tone: Tone; title?: string; children: ReactNode }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}><div className="flex gap-3"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-70" /><div>{title ? <p className="font-semibold">{title}</p> : null}<div className={title ? "mt-1 opacity-85" : ""}>{children}</div></div></div></div>;
}

export function ToastMessage({ tone = "success", children }: { tone?: Tone; children: ReactNode }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${styles[tone]}`}>{children}</div>;
}
