import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {createTranslator} from "@/lib/i18n/core";
import {formatDashboardPrice,formatTablePrice} from "@/lib/inventory/format";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("English operational presentation",()=>{
 it("uses unit-free headings and UAH-suffixed values while preserving Ukrainian conventions",()=>{
  const en=createTranslator("en"),ua=createTranslator("ua");
  expect(en("fields.priceUah")).toBe("Price");
  expect(en("inventory.filters.allCategories")).toBe("All Categories");
  expect(ua("common.all")).toBe("Усі");
  expect(en("fields.pricePerGram")).toBe("Price per Gram");
  expect(en("documents.inAppTotalValue")).toBe("Total Value");
  expect(formatTablePrice(266375,"en")).toBe("266,375.00 UAH");
  expect(formatTablePrice(266375,"ua").replace(/[\u00a0\u202f]/g," ")).toBe("266 375,00 ₴");
  expect(formatDashboardPrice(266375,"ua").replace(/[\u00a0\u202f]/g," ")).toBe("266 375,00 грн");
  expect(ua("fields.priceUah")).toBe("Ціна");
  const inventoryFilters=read("../components/inventory-filters.tsx");
  expect(inventoryFilters.match(/locale==="ua"\?t\("common\.all"\):t\("inventory\.filters\.allCategories"\)/g)).toHaveLength(1);
  expect(inventoryFilters.match(/locale==="ua"\?t\("common\.all"\):t\("inventory\.filters\.allShops"\)/g)).toHaveLength(1);
  expect(inventoryFilters).toContain('locale==="ua"?t("common.all"):t("inventory.filters.allProducers")');
  expect(inventoryFilters).toContain('locale==="ua"?t("common.all"):t("inventory.filters.allSizes")');
  expect(inventoryFilters).toContain('t("inventory.filters.allStatuses")');
 });
 it("aligns Revenue and Net Profit number styles",()=>{
  const dashboard=read("../app/(protected)/dashboard/page.tsx");
  expect(dashboard).toContain('const financialMetricClass = "mt-1.5 whitespace-nowrap text-lg font-semibold tracking-[-.025em] sm:text-xl"');
  expect(dashboard).toContain('`${financialMetricClass} text-stone-950`');
  expect(dashboard).toContain('`${financialMetricClass} ${netProfitTone(report.profit.net_profit)}`');
 });
 it("links the header logo and keeps matching detail Back emphasis",()=>{
  const layout=read("../app/(protected)/layout.tsx");
  expect(layout).toContain('<Link href="/dashboard"');
  expect(layout).toContain('aria-label={`${t("dashboard.title")} — Zlata Jewelry`}');
  for(const path of["../app/(protected)/transfers/[id]/page.tsx","../app/(protected)/documents/added-products/[id]/page.tsx"]){
   const page=read(path);expect(page).toContain('text-sm font-semibold text-stone-600');
  }
 });
});
