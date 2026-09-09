import { describe, expect, it } from "vitest";
import { previewRulePrice, validatePricingRuleForm } from "./validation";

describe("pricing rules", () => {
  it("previews fixed and percentage rules with 2-decimal rounding", () => {
    expect(previewRulePrice(3000, "FIXED_AMOUNT", 500)).toBe(3500);
    expect(previewRulePrice(3000, "PERCENTAGE", 15)).toBe(3450);
    expect(previewRulePrice(10.01, "PERCENTAGE", 12.5)).toBe(11.26);
    expect(previewRulePrice(null, "FIXED_AMOUNT", 1)).toBeNull();
  });
  it("rejects negative values and invalid scoped/date input", () => {
    const form = new FormData();
    Object.entries({ name: "Rule", scope: "SHOP", shop_id: "", rule_type: "FIXED_AMOUNT", rule_value: "-1", priority: "0", starts_at: "2026-02-02", ends_at: "2026-01-01" }).forEach(([key, value]) => form.set(key, value));
    expect(validatePricingRuleForm(form)).toMatchObject({ success: false, errors: { shop_id: expect.any(String), rule_value: expect.any(String), ends_at: expect.any(String) } });
  });
});
