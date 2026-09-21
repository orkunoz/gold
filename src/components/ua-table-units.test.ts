import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("Ukrainian in-app table units",()=>{
 it("uses a currency-bearing Inventory header with numeric-only price values",()=>{
  const table=read("./inventory-bulk-table.tsx"),detail=read("../app/(protected)/inventory/[id]/page.tsx"),form=read("./inventory-form.tsx"),draft=read("./inventory-draft-basket.tsx"),ua=read("../../locales/ua.json");
  expect(ua).toContain('"priceUah": "Ціна, грн"');
  expect(table).toContain("formatTablePrice(item.price,locale)");
  expect(detail).toContain("formatTablePrice(item.price,locale)");
  expect(form).toContain("formatTablePrice(calculated,locale)");
  expect(draft).toContain("formatTablePrice(price(entry),locale)");
  expect(draft).toContain("formatTablePrice(price(d),locale)");
 });
 it("uses numeric-only totals and localized gram units in both Documents tables",()=>{
  const page=read("../app/(protected)/documents/page.tsx"),ua=read("../../locales/ua.json");
  expect(page).toContain('const weightUnit = locale === "ua" ? "г" : "g"');
  expect(page.match(/formatTablePrice\(row\.total_value, locale\)/g)).toHaveLength(2);
  expect(page).not.toContain("{row.total_weight} g");
  expect(ua).toContain('"totalValue":"Загальна вартість, грн"');
 });
 it("leaves canonical document rendering on its existing localized presentation path",()=>{
  for(const file of["./transfer-note.tsx","./added-products-note.tsx"]){
   const note=read(file);
   expect(note).toContain("documentWeightUnit(locale)");
   expect(note).not.toContain("formatTablePrice");
  }
 });
});
