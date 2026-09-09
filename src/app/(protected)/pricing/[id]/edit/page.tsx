import { redirect } from "next/navigation";
import { PricingRuleForm } from "@/components/pricing-rule-form";
import { updatePricingRule } from "@/lib/pricing/actions";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";
import { getPricingRule } from "@/lib/pricing/queries";
export const metadata = { title: "Edit pricing rule" };
export default async function EditPricingRulePage({params}:{params:Promise<{id:string}>}){ const {id}=await params; const [employee,options,rule]=await Promise.all([getCurrentEmployee(),getInventoryOptions(),getPricingRule(id)]); if(employee.role!=="owner") redirect("/dashboard"); return <section className="max-w-4xl"><h1 className="text-3xl font-semibold">Edit pricing rule</h1><div className="mt-8 rounded-xl border border-stone-200 bg-white p-6"><PricingRuleForm action={updatePricingRule.bind(null,id)} rule={rule} shops={options.shops} categories={options.categories}/></div></section>; }
