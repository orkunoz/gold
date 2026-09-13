import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTranslator, type Locale } from "@/lib/i18n/core";
const state=vi.hoisted(()=>({locale:"ua" as Locale,notes:null as string|null}));
vi.stubGlobal("React",React);
vi.mock("@/lib/i18n/server",()=>({getTranslations:async()=>({locale:state.locale,t:createTranslator(state.locale)})}));
vi.mock("@/lib/sales/queries",()=>({getSaleDetail:async()=>({sale:{sale_number:"SALE-123",sold_at:"2026-09-12T12:00:00Z",shops:{name:"English Shop"},employee_username:"admin",total_list_price:100,total_sale_price:90,notes:state.notes},items:[{id:"line",inventory_item_id:"item",category_name:"Gold Ring",article_number:"АРТ-123",list_price:100,discount_percent:10,sale_price:90}]})}));
import SaleDetailPage from "@/app/(protected)/sales/[id]/page";
describe("completed Sale Detail rendering",()=>{
  it("renders Ukrainian labels and preserves names/articles",async()=>{
    state.locale="ua";state.notes=null;
    const html=renderToStaticMarkup(await SaleDetailPage({params:Promise.resolve({id:"sale"})}));
    for(const label of ["Завершений продаж","Дата продажу","Працівник","Сума до знижок","Підсумкова сума","Немає приміток.","Ціна до знижки","English Shop","Gold Ring","АРТ-123","admin"]){expect(html).toContain(label);}
    expect(html).not.toMatch(/Completed sale|Sold at|No notes\./);
    expect(html).toContain('href="/inventory/item"');
  });
  it("renders selectable English and escapes notes without translating them",async()=>{
    state.locale="en";state.notes="Примітка <script> & SOLD";
    const html=renderToStaticMarkup(await SaleDetailPage({params:Promise.resolve({id:"sale"})}));
    expect(html).toContain("Completed sale");expect(html).toContain("Final total");
    expect(html).toContain("Примітка &lt;script&gt; &amp; SOLD");
  });
});
