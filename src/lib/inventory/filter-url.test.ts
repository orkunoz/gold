import { describe, expect, it } from "vitest";
import { INVENTORY_FILTER_DEBOUNCE_MS, inventoryFilterFields, inventoryHref, inventoryPageHref, inventorySortHref } from "./filter-url";

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
    expect(inventoryPageHref("status=SOLD&article=ring", 2))
      .toBe("/inventory?status=SOLD&article=ring&page=2");
  });

  it("preserves explicit all statuses and sort state in the URL", () => {
    expect(inventoryHref("status=SOLD", { status: "ALL" })).toBe("/inventory?status=ALL");
    expect(inventorySortHref("status=ALL&shop=shop-1&page=4", "priceUah", "desc"))
      .toBe("/inventory?status=ALL&shop=shop-1&sort=priceUah&direction=desc");
    expect(inventoryPageHref("status=ALL&sort=article&direction=asc", 2))
      .toBe("/inventory?status=ALL&sort=article&direction=asc&page=2");
  });

  it("never exposes a shop filter control to salespeople", () => {
    expect(inventoryFilterFields("salesperson")).not.toContain("shop");
    expect(inventoryFilterFields("owner")).toContain("shop");
  });

  it("drops retired metal and removed-status query behavior", () => {
    expect(inventoryHref("metal=Gold&search=ring&status=REMOVED&page=3", { article: "A-1" })).toBe("/inventory?article=A-1");
    expect(inventoryFilterFields("owner")).not.toContain("metal");
    expect(inventoryFilterFields("owner")).not.toContain("search");
  });

  it("uses a debounce within the requested range", () => {
    expect(INVENTORY_FILTER_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
    expect(INVENTORY_FILTER_DEBOUNCE_MS).toBeLessThanOrEqual(500);
  });
});
