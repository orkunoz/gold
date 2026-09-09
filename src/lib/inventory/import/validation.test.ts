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

  it.each([
    ["28.02.2025", "2025-02-28T00:00:00.000Z"],
    ["29-02-2024", "2024-02-29T00:00:00.000Z"],
    ["01/09/2026", "2026-09-01T00:00:00.000Z"],
  ])("parses valid calendar date %s", (input, expected) => {
    expect(parseImportedDate(input)).toEqual({ value: expected });
  });

  it.each(["31.02.2026", "32-01-2026", "29/02/2025"])("rejects impossible calendar date %s", (input) => {
    expect(parseImportedDate(input)).toEqual({ value: null, error: "Invalid date" });
  });

  it("continues to parse ISO dates and rejects malformed dates", () => {
    expect(parseImportedDate("2026-09-01").value).toBe("2026-09-01T00:00:00.000Z");
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

  it("preserves imported selling prices as manual overrides and blanks as null", () => {
    const mapping = { barcode: 0, owner_price: 1, selling_price: 2 };
    const preview = validateImportRows([["MANUAL", "100", "125"], ["AUTOMATIC", "100", null]], { ...base, mapping });
    expect(preview.rows[0].item?.selling_price).toBe(125);
    expect(preview.rows[1].item?.selling_price).toBeNull();
  });

  it("enforces a manager's assigned shop", () => {
    const preview = validateImportRows([["B-1"]], { ...base, targetShopId: "other-id", role: "manager" });
    expect(preview.rows[0].errors).toContain("Managers may import only to their assigned shop");
  });
});
