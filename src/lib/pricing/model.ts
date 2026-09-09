import type { EffectivePriceSource, PricingRuleType } from "@/lib/database.types";

export type EffectivePrice = {
  effective_price: number | null;
  source: EffectivePriceSource;
  pricing_rule_id: string | null;
  rule_type: PricingRuleType | null;
  rule_value: number | null;
};

export function effectivePriceSourceLabel(source: EffectivePriceSource) {
  if (source === "MANUAL") return "Manual override";
  if (source === "PRICING_RULE") return "Pricing rule";
  return "Owner/base fallback";
}
