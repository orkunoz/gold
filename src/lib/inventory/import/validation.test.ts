import { describe, expect, it } from "vitest";
import { calculateInventoryPrice, matchCategory, normalizeImportedMetal, parseImportedDate, parseImportedNumber, removeEmptySpreadsheetRows, validateImportRows } from "./validation";

const categories = [{ id: "ring-id", name: "Ring" }, { id: "earrings-id", name: "Earrings" }, { id: "bracelet-id", name: "Bracelet" }, { id: "ua-bracelet-id", name: "Браслет" }];
const shops = [{ id: "main-id", name: "Main Shop", code: "MAIN" }, { id: "other-id", name: "Other", code: "OTHER" }];
const base = { mapping: { category: 0, weight_grams: 1, article_number: 2, price_per_gram: 3 }, targetShopId: "main-id", categories, shops, existingBarcodes: new Set<string>() };
const complete = { ...base, mapping: { ...base.mapping, producer: 4, size: 5, purchase_price: 6, barcode: 7 } };
const completeRow = ["Ring", "2.5", "A-1", "100", "Maker", "17", "", ""];

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
    expect(row).toMatchObject({ classification: "Warning", warnings:["Producer is missing","Size is missing"], item: { shop_id: "main-id", category_id: "ring-id", category_name: "Ring", weight_grams: 2.5, article_number: "A-1", price: 250, barcode: null, metal: null, gold_fineness: null, producer: null, price_per_gram: 100, discount: null, status: "IN_STOCK" } });
  });
  it("imports a new Ukrainian category without an unknown-category warning", () => {
    const row = validateImportRows([["  Браслет   оф ", "2", "UA-1", "100"]], base).rows[0];
    expect(row).toMatchObject({ classification: "Warning", warnings:["Producer is missing","Size is missing"], errors: [], item: { category_id: null, category_name: "Браслет оф" } });
  });
  it("ignores a totals row only when Article and Price Per Gram are both empty", () => {
    const preview = validateImportRows([
      ["Bracelet", "2", "A-1", "100"],
      ["Total", "2", "", "   "],
    ], base);
    expect(preview.summary).toMatchObject({ ready: 0, warnings: 1, errors: 0, ignoredRows: 1 });
    expect(preview.ignoredSourceRows).toEqual([3]);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({ sourceRow: 2, item: { article_number: "A-1", price_per_gram: 100 } });
  });
  it("keeps products with an Article visible when formula inputs are missing", () => {
    const preview=validateImportRows([["Ring",null,"A-1",null]],base);
    expect(preview.rows[0]).toMatchObject({classification:"Warning",warnings:["Producer is missing","Size is missing","Weight is missing","Price per Gram is missing"],item:{article_number:"A-1",weight_grams:null,price_per_gram:null}});
    expect(preview.summary.ignoredRows).toBe(0);
  });
  it("allows absent or blank Purchase Price without a warning",()=>{
    const absent=validateImportRows([completeRow.slice(0,6)],{...complete,mapping:{...complete.mapping,purchase_price:undefined,barcode:undefined}}).rows[0];
    const blank=validateImportRows([completeRow],complete).rows[0];
    expect(absent).toMatchObject({classification:"Ready",warnings:[],item:{purchase_price:null}});
    expect(blank).toMatchObject({classification:"Ready",warnings:[],item:{purchase_price:null}});
  });
  it("allows a blank optional Barcode without a warning",()=>{
    expect(validateImportRows([completeRow],complete).rows[0]).toMatchObject({classification:"Ready",warnings:[],item:{barcode:null}});
  });
  it.each([
    ["Product Category",0,"Product Category is missing"],
    ["Article",2,"Article is missing"],
    ["Producer",4,"Producer is missing"],
    ["Size",5,"Size is missing"],
    ["Weight",1,"Weight is missing"],
    ["Price per Gram",3,"Price per Gram is missing"],
  ])("marks missing %s as Needs attention",(_label,index,issue)=>{
    const row=[...completeRow];row[index as number]="";
    const result=validateImportRows([row],complete).rows[0];
    expect(result).toMatchObject({classification:"Warning",warnings:[issue]});
  });
  it("shows every applicable missing-field issue",()=>{
    const row=[...completeRow];for(const index of [0,4,5,1])row[index]="";
    expect(validateImportRows([row],complete).rows[0]).toMatchObject({classification:"Warning",warnings:["Product Category is missing","Producer is missing","Size is missing","Weight is missing"]});
  });
  it("keeps a blocking error above missing-field warnings",()=>{
    const row=[...completeRow];row[0]="";row[1]="-1";
    expect(validateImportRows([row],complete).rows[0]).toMatchObject({classification:"Error",errors:["Weight cannot be negative"],warnings:["Product Category is missing"]});
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
    expect(preview.ignoredSourceRows).toEqual([5,6]);
    expect(preview.summary).toMatchObject({ errors: 3, duplicates: 3 });
  });
  it("warns and stores null for malformed optional numbers, but rejects negatives", () => {
    const context = { ...base, mapping: { weight_grams: 0, price_per_gram: 1 } };
    expect(validateImportRows([["bad", "oops"]], context).rows[0]).toMatchObject({ classification: "Warning", warnings:["Product Category is missing","Article is missing","Producer is missing","Size is missing","Invalid Weight","Invalid Price per Gram"], item: { weight_grams: null, price_per_gram: null, price: null } });
    expect(validateImportRows([["-1", "-2"]], context).rows[0].errors).toHaveLength(2);
  });
  it("always uses the target Warehouse and IN_STOCK defaults", () => {
    const row=validateImportRows([["A-1","100"]],{...base,mapping:{article_number:0,price_per_gram:1}}).rows[0];
    expect(row.item).toMatchObject({shop_id:"main-id",shop_name:"Main Shop",status:"IN_STOCK"});
  });
});
