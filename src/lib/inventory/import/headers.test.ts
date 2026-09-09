import { describe, expect, it } from "vitest";
import { detectHeaderRow, normalizeHeader, suggestColumnMapping, uniqueHeaders } from "./headers";

describe("Excel header mapping", () => {
  it("detects a header after title rows", () => {
    const rows = [["Inventory report"], [null], ["Штрих-код", "Артикул", "Вага", "Ціна грн"]];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("suggests Ukrainian and English aliases", () => {
    expect(suggestColumnMapping(["Штрихкод", "Артикул", "Виріб", "Проба", "Колір", "Вага", "Розмір", "Ціна", "Примітка", "Дата"]))
      .toMatchObject({ barcode: 0, article_number: 1, category: 2, gold_fineness: 3, gold_color: 4, weight_grams: 5, size: 6, owner_price: 7, notes: 8, received_at: 9 });
    expect(suggestColumnMapping(["Barcode", "Selling Price", "Shop"])).toEqual({ barcode: 0, selling_price: 1, shop: 2 });
  });

  it("normalizes punctuation and makes duplicate headers unique", () => {
    expect(normalizeHeader(" Штрих-Код ")).toBe("штрих код");
    expect(uniqueHeaders(["Код", "Код", null])).toEqual(["Код", "Код (2)", "Column 3"]);
  });
});
