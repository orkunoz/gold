import { requireUser } from "@/lib/auth/session";
import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentEmployee } from "@/lib/inventory/queries";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const claims = await requireUser();
  const employee = await getCurrentEmployee();
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <span className="text-lg font-semibold tracking-[0.25em] text-amber-800">GOLD</span>
        <div className="flex items-center gap-4">
          <span className="hidden max-w-64 truncate text-sm text-stone-500 sm:block">{typeof claims.email === "string" ? claims.email : "Team member"}</span>
          <SignOutButton />
        </div>
        <div className="w-full"><Navigation role={employee.role} /></div>
      </div>
    </header>
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">{children}</main>
  </>;
}
