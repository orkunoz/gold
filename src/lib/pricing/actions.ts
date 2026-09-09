"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { createClient } from "@/lib/supabase/server";
import { validatePricingRuleForm, type PricingRuleErrors } from "./validation";

export type PricingActionState = { error: string; fieldErrors?: PricingRuleErrors };
async function owner() { const employee = await getCurrentEmployee(); return employee.role === "owner" ? employee : null; }
export async function createPricingRule(_state: PricingActionState, form: FormData): Promise<PricingActionState> {
  const employee = await owner(); if (!employee) return { error: "Only the Owner can manage pricing rules." };
  const validation = validatePricingRuleForm(form); if (!validation.success) return { error: "Check the highlighted fields.", fieldErrors: validation.errors };
  const supabase = await createClient(); const { error } = await supabase.from("pricing_rules").insert({ ...validation.data, created_by: employee.id });
  if (error) return { error: "Unable to create the pricing rule." };
  revalidatePath("/pricing"); redirect("/pricing");
}
export async function updatePricingRule(id: string, _state: PricingActionState, form: FormData): Promise<PricingActionState> {
  if (!await owner()) return { error: "Only the Owner can manage pricing rules." };
  const validation = validatePricingRuleForm(form); if (!validation.success) return { error: "Check the highlighted fields.", fieldErrors: validation.errors };
  const supabase = await createClient(); const { data, error } = await supabase.from("pricing_rules").update(validation.data).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { error: "Unable to update the pricing rule." };
  revalidatePath("/pricing"); redirect("/pricing");
}
export async function togglePricingRule(id: string, active: boolean) {
  if (!await owner()) return;
  const supabase = await createClient(); await supabase.from("pricing_rules").update({ is_active: active }).eq("id", id);
  revalidatePath("/pricing");
}
