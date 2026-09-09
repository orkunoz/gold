import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { getPricingRules } from "@/lib/pricing/queries";
import { togglePricingRule } from "@/lib/pricing/actions";
import { formatDateTime } from "@/lib/inventory/format";

export const metadata = { title: "Pricing rules" };
export default async function PricingPage() {
  const employee = await getCurrentEmployee(); if (employee.role !== "owner") redirect("/dashboard");
  const rules = await getPricingRules();
  return <section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Owner configuration</p><h1 className="mt-3 text-3xl font-semibold">Pricing rules</h1><p className="mt-2 text-sm text-stone-600">Configure calculated customer-price rules without changing inventory.</p></div><Link href="/pricing/new" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">Create rule</Link></div>
  <div className="mt-8 overflow-x-auto rounded-xl border border-stone-200 bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Name","Scope","Type","Value","Priority","Status","Validity",""] .map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{rules.map(rule => { const scope = [rule.shops?.name, rule.product_categories?.name].filter(Boolean).join(" + ") || "Global"; return <tr key={rule.id}><td className="px-4 py-3 font-semibold">{rule.name}</td><td className="px-4 py-3">{scope}</td><td className="px-4 py-3">{rule.rule_type === "FIXED_AMOUNT" ? "Fixed amount" : "Percentage"}</td><td className="px-4 py-3">{rule.rule_value}{rule.rule_type === "PERCENTAGE" ? "%" : " UAH"}</td><td className="px-4 py-3">{rule.priority}</td><td className="px-4 py-3">{rule.is_active ? "Active" : "Inactive"}</td><td className="px-4 py-3 text-xs">{rule.starts_at ? formatDateTime(rule.starts_at) : "Any time"} → {rule.ends_at ? formatDateTime(rule.ends_at) : "No end"}</td><td className="px-4 py-3"><div className="flex gap-3"><Link href={`/pricing/${rule.id}/edit`} className="font-medium text-amber-900">Edit</Link><form action={togglePricingRule.bind(null, rule.id, !rule.is_active)}><button className="font-medium text-stone-600">{rule.is_active ? "Deactivate" : "Activate"}</button></form></div></td></tr>; })}</tbody></table>{rules.length===0?<p className="p-10 text-center text-stone-500">No pricing rules yet.</p>:null}</div></section>;
}
