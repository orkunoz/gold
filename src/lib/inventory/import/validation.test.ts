import { describe, expect, it } from "vitest";
import { calculateInventoryPrice, matchCategory, normalizeImportedMetal, parseImportedDate, parseImportedNumber, removeEmptySpreadsheetRows, validateImportRows } from "./validation";

const categories = [{ id: "ring-id", name: "Ring" }, { id: "earrings-id", name: "Earrings" }, { id: "bracelet-id", name: "Bracelet" }, { id: "ua-bracelet-id", name: "Браслет" }];
const shops = [{ id: "main-id", name: "Main Shop", code: "MAIN" }, { id: "other-id", name: "Other", code: "OTHER" }];
const base = { mapping: { category: 0, weight_grams: 1, article_number: 2, price_per_gram: 3 }, targetShopId: "main-id", categories, shops, existingBarcodes: new Set<string>() };

describe("Excel value parsing", () => {
  it("parses localized numbers without accepting malformed data", () => {
    expect(parseImportedNumber("1 234,50 грн")).toEqual({ value: 1234.5 });
    expect(parseImportedNumber("12kg")).toMatchObject({ error: "Malformed number" });
  });
  it.each([["28.02.2025", "2025-02-28T00:00:00.000Z"], ["29-02-2024", "2024-02-29T00:00:00.000Z"], ["01/09/2026", "2026-09-01T00:00:00.000Z"]])("parses valid calendar date %s", (input, expected) => expect(parseImportedDate(input)).toEqual({ value: expected }));
  it.each(["31.02.2026", "32-01-2026", "29/02/2025"])("rejects impossible calendar date %s", (input) => expect(parseImportedDate(input)).toEqual({ value: null, error: "Invalid date" }));
  it("matches categories case-insensitively and accepts new values", () => {
    expect(matchCategory(" ring ", categories)).toEqual({ id: "ring-id", name: "Ring" });
    expect(matchCategory("  Браслет   оф ", categories)).toEqual({ id: null, name: "Браслет оф" });
    expect(matchCategory(" БРАСЛЕТ ", categories)).toEqual({ id: "ua-bracelet-id", name: "Браслет" });
    expect(matchCategory("Браслет оф", categories)).not.toEqual(matchCategory("Браслет", categories));
    expect(matchCategory("   ", categories)).toEqual({ id: null });
  });
  it.each([["Gold", "Gold"], ["gold", "Gold"], ["Золото", "Gold"], ["SILVER", "Silver"], ["Срібло", "Silver"]])("normalizes metal %s", (input, expected) => expect(normalizeImportedMetal(input)).toEqual({ value: expected }));
  it("keeps absent metal null and warns on unknown metal", () => {
    expect(normalizeImportedMetal(null)).toEqual({ value: null });
    expect(normalizeImportedMetal("Platinum")).toMatchObject({ value: null, warning: expect.any(String) });
  });
  it("removes completely blank spreadsheet rows", () => expect(removeEmptySpreadsheetRows([[null, "  "], [null, "Ring"]])).toEqual([[null, "Ring"]]));
  it("calculates price only when weight and price per gram exist",()=>{expect(calculateInventoryPrice(3.25,6000)).toBe(19500);expect(calculateInventoryPrice(null,6000)).toBeNull();expect(calculateInventoryPrice(3.25,null)).toBeNull();});
});

describe("flexible inventory import validation", () => {
  it("imports a sparse workbook and leaves unmapped fields null", () => {
    const row = validateImportRows([["Ring", "2,5", "A-1", "100"]], base).rows[0];
    expect(row).toMatchObject({ classification: "Ready", item: { shop_id: "main-id", category_id: "ring-id", category_name: "Ring", weight_grams: 2.5, article_number: "A-1", price: 250, barcode: null, metal: null, producer: null, price_per_gram: 100, discount: null, status: "IN_STOCK" } });
  });
  it("imports a new Ukrainian category without an unknown-category warning", () => {
    const row = validateImportRows([["  Браслет   оф ", "2", "UA-1", "100"]], base).rows[0];
    expect(row).toMatchObject({ classification: "Ready", warnings: [], errors: [], item: { category_id: null, category_name: "Браслет оф" } });
  });
  it("accepts no mapped columns and applies operational defaults", () => {
    const row = validateImportRows([["ignored"]], { ...base, mapping: {} }).rows[0];
    expect(row.item).toMatchObject({ shop_id: "main-id", status: "IN_STOCK", barcode: null, article_number: null });
  });
  it("checks duplicate and existing non-null barcodes but permits blanks", () => {
    const context = { ...base, mapping: { barcode: 0 }, existingBarcodes: new Set(["EXISTS"]) };
    const preview = validateImportRows([["DUP"], ["DUP"], ["EXISTS"], [null], [null]], context);
    expect(preview.rows[0].errors).toContain("Duplicate barcode in file");
    expect(preview.rows[2].errors).toContain("Barcode already exists");
    expect(preview.rows[3]).toMatchObject({ classification: "Ready", item: { barcode: null } });
    expect(preview.summary).toMatchObject({ total: 5, errors: 3, duplicates: 3 });
  });
  it("warns and stores null for malformed optional numbers, but rejects negatives", () => {
    const context = { ...base, mapping: { weight_grams: 0, price_per_gram: 1 } };
    expect(validateImportRows([["bad", "oops"]], context).rows[0]).toMatchObject({ classification: "Warning", item: { weight_grams: null, price_per_gram: null, price: null } });
    expect(validateImportRows([["-1", "-2"]], context).rows[0].errors).toHaveLength(2);
  });
  it("uses a mapped shop when valid", () => {
    const context = { ...base, mapping: { shop: 0 } };
    expect(validateImportRows([["OTHER"]], context).rows[0].item?.shop_id).toBe("other-id");
  });
});
