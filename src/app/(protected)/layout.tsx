import { requireUser } from "@/lib/auth/session";
import Image from "next/image";
import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const claims = await requireUser();
  const [employee,options] = await Promise.all([getCurrentEmployee(),getInventoryOptions()]);
  const shopName=options.shops.find((shop)=>shop.id===employee.shop_id)?.name;
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <div className="flex items-center gap-3"><Image src="/zlata-logo.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" /><span className="text-lg font-semibold tracking-[0.2em] text-amber-900">ZLATA</span></div>
        <div className="flex items-center gap-4">
          <span className="hidden max-w-64 text-right text-sm sm:block"><strong className="block truncate text-stone-800">{employee.username || employee.full_name || (typeof claims.email === "string" ? claims.email : "Team member")}</strong><span className="text-xs text-stone-500">{employee.role==="owner"?"Owner · All shops":shopName??"Assigned shop"}</span></span>
          <SignOutButton />
        </div>
        <div className="w-full"><Navigation role={employee.role} /></div>
      </div>
    </header>
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">{children}</main>
  </>;
}
