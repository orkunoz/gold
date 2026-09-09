import type { PricingRuleType, TablesInsert } from "@/lib/database.types";

export type PricingRuleErrors = Record<string, string>;
export function previewRulePrice(ownerPrice: number | null, type: PricingRuleType, value: number) {
  if (ownerPrice === null || ownerPrice < 0 || value < 0) return null;
  const result = type === "FIXED_AMOUNT" ? ownerPrice + value : ownerPrice + ownerPrice * value / 100;
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function validatePricingRuleForm(form: FormData) {
  const value = (name: string) => String(form.get(name) ?? "").trim();
  const errors: PricingRuleErrors = {};
  const name = value("name");
  const scope = value("scope");
  const ruleType = value("rule_type") as PricingRuleType;
  const ruleValue = Number(value("rule_value"));
  const priority = Number(value("priority"));
  const shopId = ["SHOP", "SHOP_CATEGORY"].includes(scope) ? value("shop_id") : null;
  const categoryId = ["CATEGORY", "SHOP_CATEGORY"].includes(scope) ? value("category_id") : null;
  const startsRaw = value("starts_at");
  const endsRaw = value("ends_at");
  const startsAt = optionalDate(startsRaw);
  const endsAt = optionalDate(endsRaw);
  if (!name || name.length > 200) errors.name = "Enter a rule name up to 200 characters.";
  if (!["GLOBAL", "SHOP", "CATEGORY", "SHOP_CATEGORY"].includes(scope)) errors.scope = "Select a valid scope.";
  if (shopId === "") errors.shop_id = "Select a shop for this scope.";
  if (categoryId === "") errors.category_id = "Select a category for this scope.";
  if (!["FIXED_AMOUNT", "PERCENTAGE"].includes(ruleType)) errors.rule_type = "Select a valid rule type.";
  if (!Number.isFinite(ruleValue) || ruleValue < 0 || (ruleType === "PERCENTAGE" ? ruleValue > 10000 : ruleValue > 999999999999.99)) errors.rule_value = "Enter a non-negative value within the supported range.";
  if (!Number.isInteger(priority) || priority < -1000000 || priority > 1000000) errors.priority = "Enter a whole priority between -1000000 and 1000000.";
  if (startsRaw && !startsAt) errors.starts_at = "Enter a valid start date.";
  if (endsRaw && !endsAt) errors.ends_at = "Enter a valid end date.";
  if (startsAt && endsAt && endsAt <= startsAt) errors.ends_at = "End date must be after start date.";
  const notes = value("notes") || null;
  if (notes && notes.length > 5000) errors.notes = "Notes cannot exceed 5000 characters.";
  if (Object.keys(errors).length) return { success: false as const, errors };
  const data: Omit<TablesInsert<"pricing_rules">, "created_by"> = { name, shop_id: shopId, category_id: categoryId, rule_type: ruleType, rule_value: ruleValue, priority, is_active: form.get("is_active") === "on", starts_at: startsAt, ends_at: endsAt, notes };
  return { success: true as const, data };
}
