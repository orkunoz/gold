import { describe, expect, it } from "vitest";
import { detectHeaderRow, normalizeHeader, suggestColumnMapping, uniqueHeaders } from "./headers";
import { IMPORT_FIELDS } from "./types";

describe("Excel header mapping", () => {
  it("exposes only the current eight import targets",()=>{
    expect(IMPORT_FIELDS).toEqual(["category","article_number","producer","size","weight_grams","purchase_price","price_per_gram","barcode"]);
  });
  it("detects a header after title rows", () => {
    const rows = [["Inventory report"], [null], ["Штрих-код", "Артикул", "Вага", "Ціна грн"]];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("suggests Ukrainian and English aliases", () => {
    expect(suggestColumnMapping(["Штрихкод", "Артикул", "Виріб", "Метал", "Виробник", "Вага", "Розмір", "Ціна", "Знижка", "Примітка", "Статус"]))
      .toEqual({ barcode: 0, article_number: 1, category: 2, producer: 4, weight_grams: 5, size: 6 });
    expect(suggestColumnMapping(["Barcode", "Price Per Gram", "Shop", "Fineness"])).toEqual({ barcode: 0, price_per_gram: 1 });
    expect(suggestColumnMapping(["Проба"])).toEqual({});
  });

  it.each(["Виріб","Вироби","Найменування","Назва виробу","Категорія виробу"])("suggests Product Category for %s",header=>expect(suggestColumnMapping([header])).toEqual({category:0}));

  it("maps both real shop workbook formats and ignores total UAH price",()=>{
    expect(suggestColumnMapping(["Виріб","Метал","Проба","Розмір","Вага","Ціна-грам","Артикул","Ціна(грн)","Примітка"])).toEqual({category:0,size:3,weight_grams:4,price_per_gram:5,article_number:6});
    expect(suggestColumnMapping(["Виріб","Виробник","Розмір","Вага","Ціна-грам","Артикул","Ціна(грн)","Примітка"])).toEqual({category:0,producer:1,size:2,weight_grams:3,price_per_gram:4,article_number:5});
  });

  it("maps only current fields in a legacy workbook",()=>{
    expect(suggestColumnMapping(["№ з/п","Виріб","Виробник","Розмір","Вага","Ціна закупки","Ціна-грам","Артикул","Примітка","Дата реалізації","Ціна(грн)"]))
      .toEqual({category:1,producer:2,size:3,weight_grams:4,purchase_price:5,price_per_gram:6,article_number:7});
  });

  it("normalizes punctuation and makes duplicate headers unique", () => {
    expect(normalizeHeader(" Штрих-Код ")).toBe("штрих код");
    expect(uniqueHeaders(["Код", "Код", null])).toEqual(["Код", "Код (2)", "Column 3"]);
  });
});
