import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getClaims } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";
import { LanguageSelector } from "@/components/language-selector";
import { getTranslations } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [claims, { t }] = await Promise.all([getClaims(), getTranslations()]);
  if (claims?.sub) redirect("/dashboard");
  return (
    <main className="login-shell flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-amber-200/60 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <Image src="/zlata-logo.png" alt="Zlata Jewelry" width={112} height={112} priority className="mx-auto mb-8 h-28 w-28 rounded-2xl object-cover shadow-md" />
        <div className="mb-5 flex justify-end"><LanguageSelector /></div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("auth.welcome")}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{t("auth.hint")}</p>
        <LoginForm />
        <p className="mt-6 text-xs leading-5 text-stone-500">{t("auth.needAccess")}</p>
      </section>
    </main>
  );
}
