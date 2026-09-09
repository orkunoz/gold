import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getPricingRules() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_rules").select("*, shops(name), product_categories(name)").order("priority", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load pricing rules.");
  return data ?? [];
}
export async function getPricingRule(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_rules").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this pricing rule.");
  if (!data) notFound();
  return data;
}
