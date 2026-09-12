import { describe, expect, it } from "vitest";
import { validateInventoryForm } from "./validation";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = { shop_id: "shop-id", barcode: "CODE-1", status: "IN_STOCK", ...overrides };
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("inventory form validation", () => {
  it("trims text and accepts valid optional values", () => {
    const result = validateInventoryForm(form({ barcode: "  CODE-1  ", article_number: " A-7 ", category_name: "  Браслет   оф  ", weight_grams: "2.345", owner_price: "100" }));
    expect(result).toMatchObject({ success: true, data: { barcode: "CODE-1", article_number: "A-7", category_name: "Браслет оф", weight_grams: 2.345, owner_price: 100, selling_price: null } });
  });

  it("stores a blank category as null", () => {
    expect(validateInventoryForm(form({ category_name: "   " }))).toMatchObject({ success: true, data: { category_name: null } });
  });

  it.each(["Gold", "Silver", "Золота Україна", "Жадент"])('accepts arbitrary metal value "%s"', (metal) => {
    expect(validateInventoryForm(form({ metal: `  ${metal}  ` }))).toMatchObject({ success: true, data: { metal } });
  });

  it("accepts and preserves an arbitrary Ukrainian producer", () => {
    expect(validateInventoryForm(form({ producer: "  Виробник Жадент  " }))).toMatchObject({ success: true, data: { producer: "Виробник Жадент" } });
  });

  it("stores blank metal and producer values as null", () => {
    expect(validateInventoryForm(form({ metal: "   ", producer: "   " }))).toMatchObject({ success: true, data: { metal: null, producer: null } });
  });

  it("allows an unassigned shop and a null barcode", () => {
    const result = validateInventoryForm(form({ barcode: "", shop_id: "" }));
    expect(result).toMatchObject({ success: true, data: { shop_id:null,barcode:null } });
    expect(validateInventoryForm(form({ barcode: "" }))).toMatchObject({ success: true, data: { barcode: null } });
  });

  it.each(["weight_grams", "owner_price", "selling_price", "price_per_gram"])("rejects invalid %s", (field) => {
    const result = validateInventoryForm(form({ [field]: "-1" }));
    expect(result).toMatchObject({ success: false, errors: { [field]: expect.any(String) } });
  });

  it("rejects an unknown inventory status", () => {
    expect(validateInventoryForm(form({ status: "UNKNOWN" }))).toMatchObject({ success: false, errors: { status: expect.any(String) } });
  });
});
