import { describe, expect, it } from "vitest";
import { INVENTORY_FILTER_DEBOUNCE_MS, inventoryFilterFields, inventoryHref, inventoryPageHref } from "./filter-url";

describe("inventory filter navigation", () => {
  it("updates filters in the URL and resets pagination", () => {
    expect(inventoryHref("status=SOLD&page=3", { barcode: " 123 " }))
      .toBe("/inventory?status=SOLD&barcode=123");
  });

  it("removes cleared filters while preserving the others", () => {
    expect(inventoryHref("status=IN_STOCK&shop=shop-1", { status: "" }))
      .toBe("/inventory?shop=shop-1");
  });

  it("keeps active filters in pagination links", () => {
    expect(inventoryPageHref("status=REMOVED&search=ring", 2))
      .toBe("/inventory?status=REMOVED&search=ring&page=2");
  });

  it("never exposes a shop filter control to salespeople", () => {
    expect(inventoryFilterFields("salesperson")).not.toContain("shop");
    expect(inventoryFilterFields("owner")).toContain("shop");
  });

  it("uses a debounce within the requested range", () => {
    expect(INVENTORY_FILTER_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
    expect(INVENTORY_FILTER_DEBOUNCE_MS).toBeLessThanOrEqual(500);
  });
});
