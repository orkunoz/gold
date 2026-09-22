import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("Ukrainian in-app currency convention",()=>{
 it("keeps Dashboard KPIs on the грн formatter and table values on the ₴ formatter",()=>{
  const metric=read("./metric-count-up.tsx"),dashboard=read("../app/(protected)/dashboard/page.tsx");
  expect(metric).toContain("formatDashboardPrice(number, locale)");
  expect(dashboard.match(/formatTablePrice\(/g)).toHaveLength(3);
  for(const heading of['t("dashboard.revenue")','t("common.total")'])expect(dashboard).toContain(heading);
 });

 it("uses unit-free Inventory headers and the shared operational formatter for all prices",()=>{
  const ua=read("../../locales/ua.json"),table=read("./inventory-bulk-table.tsx"),detail=read("../app/(protected)/inventory/[id]/page.tsx");
  expect(ua).toContain('"purchasePrice": "Ціна закупки"');
  expect(ua).toContain('"pricePerGram": "Ціна за грам"');
  expect(ua).toContain('"priceUah": "Ціна"');
  for(const value of ["item.purchase_price","item.price_per_gram","item.price"])expect(table).toContain(`formatTablePrice(${value},locale)`);
  for(const value of ["item.purchase_price","item.price_per_gram","item.price"])expect(detail).toContain(`formatTablePrice(${value},locale)`);
 });

 it("uses the operational formatter in Sales and Sale Detail tables",()=>{
  const sales=read("../app/(protected)/sales/page.tsx"),detail=read("../app/(protected)/sales/[id]/page.tsx"),checkout=read("./sales-checkout.tsx");
  expect(sales).toContain("formatTablePrice(sale.total_sale_price,locale)");
  expect(detail).toContain("formatTablePrice(item.list_price, locale)");
  expect(detail).toContain("formatTablePrice(item.sale_price, locale)");
  expect(checkout).toContain("formatTablePrice(discountedPrice(item.listPrice, item.discountPercent),locale)");
 });

 it("restores the accepted in-app document presentation with unit-free labels, ₴ values, and Ukrainian gram units",()=>{
  const ua=read("../../locales/ua.json"),list=read("../app/(protected)/documents/page.tsx"),transfer=read("../app/(protected)/transfers/[id]/page.tsx"),receipt=read("../app/(protected)/documents/added-products/[id]/page.tsx");
  expect(ua).toContain('"inAppTotalValue":"Загальна вартість"');
  expect(list.match(/t\("documents\.inAppTotalValue"\)/g)).toHaveLength(2);
  expect(list.match(/formatTablePrice\(row\.total_value, locale\)/g)).toHaveLength(2);
  for(const detail of [transfer,receipt]){
   expect(detail).toContain('t("common.grams")');
   expect(detail).toContain("formatTablePrice(");
   expect(detail).toContain("presentation={{formatPrice");
   expect(detail).not.toContain("DocumentDetailView");
  }
  expect(transfer).toContain("<TransferNote");
  expect(receipt).toContain("<AddedProductsNote");
 });

 it("uses the hryvnia symbol in canonical Ukrainian generated documents without changing the in-app convention",()=>{
  for(const file of["./transfer-note.tsx","./added-products-note.tsx"]){
   const note=read(file);
   expect(note).toContain("documentWeightUnit(locale)");
   expect(note).toContain("formatDocumentPrice");
   expect(note).not.toContain("formatTablePrice");
  }
  const transferPdf=read("../lib/transfers/pdf.test.ts"),receiptPdf=read("../lib/added-products/pdf.test.ts");
  for(const test of[transferPdf,receiptPdf])expect(test).toContain("Загальна вартість</span><strong>591 214,00 ₴</strong>");
 });
});
