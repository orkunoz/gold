import { redirect } from "next/navigation";
import { PricingRuleForm } from "@/components/pricing-rule-form";
import { createPricingRule } from "@/lib/pricing/actions";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
export const metadata = { title: "Create pricing rule" };
export default async function NewPricingRulePage(){ const [employee, options]=await Promise.all([getCurrentEmployee(),getInventoryOptions()]); if(employee.role!=="owner") redirect("/dashboard"); return <section className="max-w-4xl"><h1 className="text-3xl font-semibold">Create pricing rule</h1><div className="mt-8 rounded-xl border border-stone-200 bg-white p-6"><PricingRuleForm action={createPricingRule} shops={options.shops} categories={options.categories}/></div></section>; }
