import { describe, expect, it } from "vitest";
import { detectHeaderRow, normalizeHeader, suggestColumnMapping, uniqueHeaders } from "./headers";

describe("Excel header mapping", () => {
  it("detects a header after title rows", () => {
    const rows = [["Inventory report"], [null], ["Штрих-код", "Артикул", "Вага", "Ціна грн"]];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("suggests Ukrainian and English aliases", () => {
    expect(suggestColumnMapping(["Штрихкод", "Артикул", "Виріб", "Метал", "Виробник", "Вага", "Розмір", "Ціна", "Знижка", "Примітка", "Статус"]))
      .toMatchObject({ barcode: 0, article_number: 1, category: 2, metal: 3, producer: 4, weight_grams: 5, size: 6, discount: 8, notes: 9, status: 10 });
    expect(suggestColumnMapping(["Barcode", "Price Per Gram", "Shop"])).toEqual({ barcode: 0, price_per_gram: 1, shop: 2 });
  });

  it.each(["Виріб","Вироби","Найменування","Назва виробу","Категорія виробу"])("suggests Product Category for %s",header=>expect(suggestColumnMapping([header])).toEqual({category:0}));

  it("normalizes punctuation and makes duplicate headers unique", () => {
    expect(normalizeHeader(" Штрих-Код ")).toBe("штрих код");
    expect(uniqueHeaders(["Код", "Код", null])).toEqual(["Код", "Код (2)", "Column 3"]);
  });
});
