import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClaims } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const claims = await getClaims();
  if (claims?.sub) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="mb-10 text-lg font-semibold tracking-[0.25em] text-amber-800">GOLD</p>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Sign in to your jewelry business workspace.</p>
        <LoginForm />
        <p className="mt-6 text-xs leading-5 text-stone-500">Need access? Contact your business administrator.</p>
      </section>
    </main>
  );
}
