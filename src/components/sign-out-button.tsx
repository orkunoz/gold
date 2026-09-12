"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { useI18n } from "./i18n-provider";

export function SignOutButton() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div>
    <button disabled={pending} className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-60"
      onClick={() => startTransition(async () => {
        setError("");
        try { await signOut(); } catch (error) {
          unstable_rethrow(error);
          setError(t("auth.signOutError"));
        }
      })}>{pending ? t("auth.signingOut") : t("auth.signOut")}</button>
    <p role="status" className="mt-1 text-xs text-red-700">{error}</p>
  </div>;
}
