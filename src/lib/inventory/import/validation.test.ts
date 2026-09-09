import { describe, expect, it } from "vitest";
import { matchCategory, parseImportedDate, parseImportedNumber, validateImportRows } from "./validation";

const categories = [{ id: "ring-id", name: "Ring" }, { id: "earrings-id", name: "Earrings" }];
const shops = [{ id: "main-id", name: "Main Shop", code: "MAIN" }, { id: "other-id", name: "Other", code: "OTHER" }];
const base = { mapping: { barcode: 0, weight_grams: 1, owner_price: 2, category: 3 }, targetShopId: "main-id", role: "owner" as const, employeeShopId: "main-id", categories, shops, existingBarcodes: new Set<string>() };

describe("Excel value parsing", () => {
  it("parses localized numbers without accepting malformed data", () => {
    expect(parseImportedNumber("1 234,50 грн")).toEqual({ value: 1234.5 });
    expect(parseImportedNumber("12kg")).toMatchObject({ error: "Malformed number" });
  });

  it("parses Ukrainian and ISO dates", () => {
    expect(parseImportedDate("08.09.2026").value).toBe("2026-09-08T00:00:00.000Z");
    expect(parseImportedDate("not a date")).toMatchObject({ error: "Invalid date" });
  });

  it("matches categories case-insensitively and warns for unknown values", () => {
    expect(matchCategory(" ring ", categories)).toEqual({ id: "ring-id" });
    expect(matchCategory("Rign", categories)).toMatchObject({ id: null, warning: expect.any(String) });
  });
});

describe("inventory import validation", () => {
  it("classifies a valid row as ready", () => {
    expect(validateImportRows([["B-1", "2,5", "100", "ring"]], base).rows[0]).toMatchObject({ classification: "Ready", item: { barcode: "B-1", weight_grams: 2.5, owner_price: 100, category_id: "ring-id" } });
  });

  it("detects missing, in-file duplicate, and existing barcodes", () => {
    const preview = validateImportRows([["DUP"], ["DUP"], ["EXISTS"], [null]], { ...base, existingBarcodes: new Set(["EXISTS"]) });
    expect(preview.rows[0].errors).toContain("Duplicate barcode in file");
    expect(preview.rows[2].errors).toContain("Barcode already exists");
    expect(preview.rows[3].errors).toContain("Missing barcode");
    expect(preview.summary).toMatchObject({ total: 4, errors: 4, duplicates: 3 });
  });

  it("rejects malformed and negative values", () => {
    const preview = validateImportRows([["B-1", "bad", "-5"]], base);
    expect(preview.rows[0].errors).toEqual(expect.arrayContaining(["Invalid weight", "Owner price cannot be negative"]));
  });

  it("allows an unknown category with a warning", () => {
    expect(validateImportRows([["B-1", null, null, "Rign"]], base).rows[0]).toMatchObject({ classification: "Warning", warnings: [expect.stringContaining("Unknown category")] });
  });

  it("enforces a manager's assigned shop", () => {
    const preview = validateImportRows([["B-1"]], { ...base, targetShopId: "other-id", role: "manager" });
    expect(preview.rows[0].errors).toContain("Managers may import only to their assigned shop");
  });
});
