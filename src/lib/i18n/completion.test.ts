import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "./core";
import { inventoryResultSummary } from "@/lib/inventory/pagination";
import { historyField, historySource, historyValue } from "@/lib/inventory/history-display";
import { validateImportRows } from "@/lib/inventory/import/validation";
import { uniqueHeaders } from "@/lib/inventory/import/headers";
import en from "../../../locales/en.json";
import ua from "../../../locales/ua.json";

const read = (file: string) => readFileSync(file, "utf8");
describe("localization completion", () => {
  it.each([[0,"виробів"],[1,"виріб"],[2,"вироби"],[5,"виробів"],[11,"виробів"],[21,"виріб"],[22,"вироби"],[25,"виробів"],[111,"виробів"]])("uses Ukrainian plural forms for %i", (count, noun) => {
    expect(translate("ua", "inventory.productCount", {count})).toBe(`${count} ${noun}`);
    expect(translate("ua", "sales.itemCount", {count})).toBe(`${count} ${noun}`);
  });
  it("localizes single and paginated inventory totals", () => {
    expect(inventoryResultSummary(1,50,1,1,"ua")).toBe("Показано 1 із 1 виробу");
    expect(inventoryResultSummary(2,50,137,50,"ua")).toBe("Показано 51–100 із 137 виробів");
    expect(inventoryResultSummary(1,50,0,0,"ua")).toBe("0 виробів");
    expect(inventoryResultSummary(1,50,1,1,"en")).toBe("Showing 1 of 1 product");
    expect(translate("ua","inventory.selectAll")).toBe("Вибрати всі на поточній сторінці");
  });
  it("localizes import counts and preserves source headers", () => {
    expect(translate("ua","import.importValid",{count:1})).toBe("Імпортувати 1 коректний виріб");
    expect(translate("ua","import.importValid",{count:22})).toBe("Імпортувати 22 коректні вироби");
    expect(translate("ua","import.importValid",{count:11})).toBe("Імпортувати 11 коректних виробів");
    expect(uniqueHeaders([null,"Column 2","Виріб"],"ua")).toEqual(["Стовпець 1","Column 2","Виріб"]);
  });
  it("localizes import validation without changing classifications, totals or business data", () => {
    const rows = [["ABC","oops","SOLD","A-1","100"],["ABC","10","SOLD","A-2","strange"]];
    const context = {mapping:{barcode:0,weight_grams:1,category:2,article_number:3,price_per_gram:4},targetShopId:"shop",categories:[],shops:[{id:"shop",name:"English Shop",code:null}],existingBarcodes:new Set<string>()};
    const english=validateImportRows(rows,{...context,locale:"en"});
    const ukrainian=validateImportRows(rows,{...context,locale:"ua"});
    expect(ukrainian.summary).toEqual(english.summary);
    expect(ukrainian.summary.duplicates).toBe(2);
    expect(ukrainian.rows.map(row=>row.item)).toEqual(english.rows.map(row=>row.item));
    expect(ukrainian.rows[0].errors).toContain("Дублікат штрихкоду у файлі");
    expect(ukrainian.rows[0].warnings).toContain("Некоректна вага");
    expect(ukrainian.rows[1].warnings).toContain("Некоректна ціна за грам");
    expect(ukrainian.rows[0].item?.category_name).toBe("SOLD");
  });
  it("localizes known history labels only in their display context", () => {
    expect(historyField("Product Category","ua")).toBe(ua.fields.productCategory);
    expect(historyField("CREATED","ua")).toBe("Створено");
    expect(historyValue("CREATED","Inventory item created","ua")).toBe("Виріб створено");
    for(const code of ["IN_STOCK","SOLD","REMOVED"]){
      expect(historyValue("Status",code,"ua")).toBe(translate("ua",`status.${code}`));
      expect(historyValue("Notes",code,"ua")).toBe(code);
      expect(historyValue("Shop",code,"ua")).toBe(code);
    }
    for(const code of ["MANUAL_EDIT","XLSX_IMPORT","SALE","STATUS_CHANGE","SHOP_TRANSFER","SYSTEM"]){
      expect(historySource(code,"ua")).toMatch(/[А-Яа-яІіЇїЄє]/);
      expect(historyValue("Producer",code,"ua")).toBe(code);
    }
    expect(historySource("FUTURE_SOURCE","ua")).toBe("FUTURE_SOURCE");
    expect(historyValue("Notes","Примітка & <script>","ua")).toBe("Примітка & <script>");
  });
  it("keeps listed English copy out of the import UI", () => {
    const source=read("src/components/inventory-import.tsx");
    for(const text of ["Detected headers on spreadsheet row","Validation errors skipped","Return to inventory","Import another file","Source row numbers match","Importing…"]){expect(source).not.toContain(text);}
    expect(source).toContain('t("import.detectedHeaders"');
    expect(source).toContain('t(`import.summary.${label}`)');
    expect(source).toContain('t("import.importValid"');
    expect(source).toContain('t("import.validationSkipped")');
  });
  it("removes the notes counter and limit, and localizes barcode fallbacks", () => {
    const source=read("src/components/sales-checkout.tsx");
    expect(source).toContain('t("sales.noBarcode")');
    expect(translate("ua","sales.noBarcode")).toBe("Без штрихкоду");
    expect(translate("en","sales.noBarcode")).toBe("No barcode");
    expect(source).not.toMatch(/maxLength|5000|notesTooLong|notes\.length/);
    expect(read("src/lib/sales/actions.ts")).not.toMatch(/5000|notes\.length/);
  });
  it("labels current and sold stock weights separately and links only the sale number", () => {
    const source=read("src/app/(protected)/dashboard/page.tsx");
    expect(source).toContain('t("dashboard.inStockGoldWeight")}</dt><dd');
    expect(source).toContain('grams(inventory.in_stock_weight,locale)');
    expect(source).toContain('t("dashboard.goldWeightSold")');
    expect(source).toMatch(/<Link href=\{`\/sales\/\$\{sale.id\}`\}[^>]*>\{sale.sale_number\}<\/Link>/);
    expect(source).not.toContain('t("sales.viewDetails")');
    expect(source).not.toContain('t("common.total"),""');
    expect(en.dashboard.goldWeightSold).toBe("Weight Sold");
    expect(ua.dashboard.goldWeightSold).toBe("Продана вага");
    expect(en.dashboard.inStockGoldWeight).toBe("In-stock Weight");
    expect(ua.dashboard.inStockGoldWeight).toBe("Вага в наявності");
  });
  it("changes only the notes guard in the current database function", () => {
    const original=read("supabase/migrations/20260910190000_task11_dynamic_categories_checkout.sql");
    const start=original.indexOf("create or replace function public.complete_sale(");
    const current=original.slice(start,original.indexOf("$$;",start)+3).replace(/  if length\(normalized_notes\) > 5000[^\n]*\r?\n/,"");
    const migration=read("supabase/migrations/20260913120000_unlimited_sale_notes.sql");
    expect(migration.slice(migration.indexOf("create or replace")).trim()).toBe(current.trim());
  });
});
