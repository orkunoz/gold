"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { PricingRuleType, Tables } from "@/lib/database.types";
import type { PricingActionState } from "@/lib/pricing/actions";
import { previewRulePrice } from "@/lib/pricing/validation";
import { formatPrice } from "@/lib/inventory/format";

type Action = (state: PricingActionState, form: FormData) => Promise<PricingActionState>;
const initial: PricingActionState = { error: "" };
const input = "mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5";
const dt = (value: string | null | undefined) => value ? new Date(value).toISOString().slice(0, 16) : "";

export function PricingRuleForm({ action, rule, shops, categories }: { action: Action; rule?: Tables<"pricing_rules">; shops: Pick<Tables<"shops">, "id" | "name">[]; categories: Pick<Tables<"product_categories">, "id" | "name">[] }) {
  const defaultScope = rule?.shop_id && rule.category_id ? "SHOP_CATEGORY" : rule?.shop_id ? "SHOP" : rule?.category_id ? "CATEGORY" : "GLOBAL";
  const [scope, setScope] = useState(defaultScope);
  const [type, setType] = useState<PricingRuleType>(rule?.rule_type ?? "FIXED_AMOUNT");
  const [value, setValue] = useState(String(rule?.rule_value ?? 0));
  const [ownerPrice, setOwnerPrice] = useState("3000");
  const [state, formAction, pending] = useActionState(action, initial);
  const preview = previewRulePrice(ownerPrice === "" ? null : Number(ownerPrice), type, Number(value));
  const error = (name: string) => state.fieldErrors?.[name] ? <span className="mt-1 block text-sm text-red-700">{state.fieldErrors[name]}</span> : null;
  return <form action={formAction} className="space-y-6">
    {state.error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{state.error}</p> : null}
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Rule name<input name="name" required maxLength={200} defaultValue={rule?.name ?? ""} className={input} />{error("name")}</label>
      <label className="text-sm font-medium">Scope<select name="scope" value={scope} onChange={(e) => setScope(e.target.value)} className={input}><option value="GLOBAL">Global</option><option value="SHOP">Shop</option><option value="CATEGORY">Category</option><option value="SHOP_CATEGORY">Shop + Category</option></select>{error("scope")}</label>
      {scope.includes("SHOP") ? <label className="text-sm font-medium">Shop<select name="shop_id" required defaultValue={rule?.shop_id ?? ""} className={input}><option value="">Select shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>{error("shop_id")}</label> : null}
      {scope.includes("CATEGORY") ? <label className="text-sm font-medium">Category<select name="category_id" required defaultValue={rule?.category_id ?? ""} className={input}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{error("category_id")}</label> : null}
      <label className="text-sm font-medium">Rule type<select name="rule_type" value={type} onChange={(e) => setType(e.target.value as PricingRuleType)} className={input}><option value="FIXED_AMOUNT">Fixed amount</option><option value="PERCENTAGE">Percentage</option></select></label>
      <label className="text-sm font-medium">Rule value<input name="rule_value" type="number" min="0" step="0.0001" required value={value} onChange={(e) => setValue(e.target.value)} className={input} />{error("rule_value")}</label>
      <label className="text-sm font-medium">Priority<input name="priority" type="number" step="1" defaultValue={rule?.priority ?? 0} className={input} />{error("priority")}</label>
      <label className="flex items-center gap-3 self-end rounded-lg border border-stone-200 p-3"><input name="is_active" type="checkbox" defaultChecked={rule?.is_active ?? true} /> <span className="text-sm font-medium">Active</span></label>
      <label className="text-sm font-medium">Starts at<input name="starts_at" type="datetime-local" defaultValue={dt(rule?.starts_at)} className={input} />{error("starts_at")}</label>
      <label className="text-sm font-medium">Ends at<input name="ends_at" type="datetime-local" defaultValue={dt(rule?.ends_at)} className={input} />{error("ends_at")}</label>
    </div>
    <label className="block text-sm font-medium">Notes<textarea name="notes" maxLength={5000} rows={3} defaultValue={rule?.notes ?? ""} className={input} /></label>
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-semibold">Price preview</h2><label className="mt-3 block max-w-xs text-sm">Owner price<input type="number" min="0" step="0.01" value={ownerPrice} onChange={(e) => setOwnerPrice(e.target.value)} className={input} /></label><p className="mt-3 text-lg font-semibold">{ownerPrice === "" ? "—" : formatPrice(Number(ownerPrice))} → {preview === null ? "—" : formatPrice(preview)}</p><p className="mt-1 text-xs text-stone-500">Informational only. No inventory price is changed.</p></div>
    <div className="flex gap-3 border-t border-stone-200 pt-5"><button disabled={pending} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Saving…" : rule ? "Save rule" : "Create rule"}</button><Link href="/pricing" className="px-5 py-2.5 text-sm font-medium text-stone-600">Cancel</Link></div>
  </form>;
}
