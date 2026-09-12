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
    expect(suggestColumnMapping(["Barcode", "Price Per Gram", "Shop", "Fineness"])).toEqual({ barcode: 0, price_per_gram: 1, shop: 2, fineness: 3 });
    expect(suggestColumnMapping(["Проба"])).toEqual({ fineness: 0 });
  });

  it.each(["Виріб","Вироби","Найменування","Назва виробу","Категорія виробу"])("suggests Product Category for %s",header=>expect(suggestColumnMapping([header])).toEqual({category:0}));

  it("maps both real shop workbook formats and ignores total UAH price",()=>{
    expect(suggestColumnMapping(["Виріб","Метал","Проба","Розмір","Вага","Ціна-грам","Артикул","Ціна(грн)","Примітка"])).toEqual({category:0,metal:1,fineness:2,size:3,weight_grams:4,price_per_gram:5,article_number:6,notes:8});
    expect(suggestColumnMapping(["Виріб","Виробник","Розмір","Вага","Ціна-грам","Артикул","Ціна(грн)","Примітка"])).toEqual({category:0,producer:1,size:2,weight_grams:3,price_per_gram:4,article_number:5,notes:7});
  });

  it("normalizes punctuation and makes duplicate headers unique", () => {
    expect(normalizeHeader(" Штрих-Код ")).toBe("штрих код");
    expect(uniqueHeaders(["Код", "Код", null])).toEqual(["Код", "Код (2)", "Column 3"]);
  });
});
