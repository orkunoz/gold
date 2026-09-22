import { describe, expect, it } from "vitest";
import { MAX_PURCHASE_PRICE, parseRequiredPurchasePrice } from "./purchase-price";

describe("bulk Purchase Price validation", () => {
  it.each([["25000", 25000], ["25000.00", 25000], ["0", 0], [String(MAX_PURCHASE_PRICE), MAX_PURCHASE_PRICE]])("accepts %s", (raw, expected) => {
    expect(parseRequiredPurchasePrice(raw)).toBe(expected);
  });

  it.each(["", "   ", "invalid", "12.3.4", "-0.01", "1000000000000"])("rejects %j", (raw) => {
    expect(parseRequiredPurchasePrice(raw)).toBeNull();
  });
});
