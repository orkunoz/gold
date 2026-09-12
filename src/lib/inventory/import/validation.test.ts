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
  it.each([["Gold", "Gold"], ["Silver", "Silver"], ["  Золота Україна  ", "Золота Україна"], ["Жадент", "Жадент"]])("trims and preserves metal %s", (input, expected) => expect(normalizeImportedMetal(input)).toEqual({ value: expected }));
  it("keeps absent and blank metal null", () => {
    expect(normalizeImportedMetal(null)).toEqual({ value: null });
    expect(normalizeImportedMetal("   ")).toEqual({ value: null });
  });
  it("removes completely blank spreadsheet rows", () => expect(removeEmptySpreadsheetRows([[null, "  "], [null, "Ring"]])).toEqual([[null, "Ring"]]));
  it("calculates price only when weight and price per gram exist",()=>{expect(calculateInventoryPrice(3.25,6000)).toBe(19500);expect(calculateInventoryPrice(null,6000)).toBeNull();expect(calculateInventoryPrice(3.25,null)).toBeNull();});
});

describe("flexible inventory import validation", () => {
  it("imports a sparse workbook and leaves unmapped fields null", () => {
    const row = validateImportRows([["Ring", "2,5", "A-1", "100"]], base).rows[0];
    expect(row).toMatchObject({ classification: "Ready", item: { shop_id: "main-id", category_id: "ring-id", category_name: "Ring", weight_grams: 2.5, article_number: "A-1", price: 250, barcode: null, metal: null, gold_fineness: null, producer: null, price_per_gram: 100, discount: null, status: "IN_STOCK" } });
  });
  it("imports a new Ukrainian category without an unknown-category warning", () => {
    const row = validateImportRows([["  Браслет   оф ", "2", "UA-1", "100"]], base).rows[0];
    expect(row).toMatchObject({ classification: "Ready", warnings: [], errors: [], item: { category_id: null, category_name: "Браслет оф" } });
  });
  it("accepts no mapped columns and applies operational defaults", () => {
    const row = validateImportRows([["ignored"]], { ...base, mapping: {} }).rows[0];
    expect(row.item).toMatchObject({ shop_id: "main-id", status: "IN_STOCK", barcode: null, article_number: null });
  });
  it("ignores a totals row when the mapped Price Per Gram cell is empty", () => {
    const preview = validateImportRows([
      ["Bracelet", "2", "A-1", "100"],
      ["Total", "2", "TOTAL", "   "],
    ], base);
    expect(preview.summary).toMatchObject({ total: 1, ready: 1, warnings: 0, errors: 0 });
    expect(preview.summary.footerSkipped).toBe(1);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({ sourceRow: 2, item: { article_number: "A-1", price_per_gram: 100 } });
  });
  it("imports new Ukrainian metal and producer values without warnings", () => {
    const row = validateImportRows([["  Золота Україна  ", "  Жадент  "]], { ...base, mapping: { metal: 0, producer: 1 } }).rows[0];
    expect(row).toMatchObject({ classification: "Ready", warnings: [], errors: [], item: { metal: "Золота Україна", producer: "Жадент" } });
  });
  it("imports blank metal and producer values as null", () => {
    const row = validateImportRows([["   ", null]], { ...base, mapping: { metal: 0, producer: 1 } }).rows[0];
    expect(row).toMatchObject({ classification: "Ready", warnings: [], item: { metal: null, producer: null } });
  });
  it("preserves original worksheet row numbers after blank rows were removed",()=>{
    const preview=validateImportRows([["Ring","2","A-1","100"],["Ring","3","A-2","100"]],{...base,sourceRows:[4,7]});
    expect(preview.rows.map(row=>row.sourceRow)).toEqual([4,7]);
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
    expect(validateImportRows([["bad", "oops"]], context).rows[0]).toMatchObject({ classification: "Warning", warnings:expect.arrayContaining([expect.stringContaining("formula price")]), item: { weight_grams: null, price_per_gram: null, price: null } });
    expect(validateImportRows([["-1", "-2"]], context).rows[0].errors).toHaveLength(2);
  });
  it("uses a mapped shop when valid", () => {
    const context = { ...base, mapping: { shop: 0 } };
    expect(validateImportRows([["OTHER"]], context).rows[0].item?.shop_id).toBe("other-id");
  });
  it("maps optional fineness without restricting business values", () => {
    const row = validateImportRows([["585"]], { ...base, mapping: { fineness: 0 } }).rows[0];
    expect(row.item?.gold_fineness).toBe("585");
  });
});
