import { describe, expect, it } from "vitest";
import { effectivePriceSourceLabel } from "./model";

describe("effective pricing presentation", () => {
  it("uses understandable labels for every authoritative source", () => {
    expect(effectivePriceSourceLabel("MANUAL")).toBe("Manual override");
    expect(effectivePriceSourceLabel("PRICING_RULE")).toBe("Pricing rule");
    expect(effectivePriceSourceLabel("OWNER_PRICE_FALLBACK")).toBe("Owner/base fallback");
  });
});
