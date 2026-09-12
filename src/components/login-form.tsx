"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/auth/actions";
import { useI18n } from "./i18n-provider";

export function LoginForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <form action={action} className="mt-8 space-y-5" aria-busy={pending}>
      <div>
        <label htmlFor="username" className="mb-2 block text-sm font-medium">{t("auth.username")}</label>
        <input id="username" name="username" type="text" autoComplete="username" required maxLength={32} autoCapitalize="none" spellCheck={false}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">{t("auth.password")}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={4096}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3" />
      </div>
      <p aria-live="polite" className="text-sm text-red-700">{state.error}</p>
      <button disabled={pending} className="w-full rounded-lg bg-stone-900 px-4 py-3 font-medium text-white hover:bg-stone-700 disabled:opacity-60">
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </button>
    </form>
  );
}
