"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { useI18n } from "./i18n-provider";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div>
    <button disabled={pending} role={compact ? "menuitem" : undefined} className={compact ? "w-full rounded-lg px-2.5 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60" : "rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-60"}
      onClick={() => startTransition(async () => {
        setError("");
        try { await signOut(); } catch (error) {
          unstable_rethrow(error);
          setError(t("auth.signOutError"));
        }
      })}>{pending ? t("auth.signingOut") : t("auth.signOut")}</button>
    {error ? <p role="alert" className="mt-1 px-2.5 text-xs text-red-700">{error}</p> : null}
  </div>;
}
