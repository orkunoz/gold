import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "@/lib/i18n/core";
const state=vi.hoisted(()=>({values:[] as unknown[]}));
vi.mock("react",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("react")>();
  return {...actual,useState:()=>[state.values.shift(),()=>{}]};
});
vi.mock("./i18n-provider",()=>({useI18n:()=>({locale:"ua",t:createTranslator("ua")})}));
vi.stubGlobal("React",React);
import { InventoryImport } from "./inventory-import";
describe("Import Inventory rendered states",()=>{
  it("renders preview labels in Ukrainian and leaves spreadsheet values intact",()=>{
    const parsed={selectedSheet:"Sheet One",sheetNames:["Sheet One"],headerRow:2,headers:["Original English Header"],rows:[["Original English Data"]],sourceRows:[4],suggestedMapping:{}};
    const preview={summary:{sourceRows:1,total:1,ready:1,warnings:0,errors:0,duplicates:0,footerSkipped:0},rows:[{sourceRow:4,classification:"Ready",errors:[],warnings:[],item:{category_name:"Original English Data",metal:"Gold",producer:"Producer",status:"IN_STOCK"}}]};
    state.values=[{name:"items.xlsx"},parsed,{},"shop",preview,null,"",false];
    const html=renderToStaticMarkup(React.createElement(InventoryImport,{employeeShopId:"shop",shops:[{id:"shop",name:"English Shop",code:null}]}));
    for(const text of ["Заголовки виявлено в рядку 3","Рядок джерела","Попередження","Помилки","Імпортувати 1 коректний виріб","В наявності","Original English Header","Original English Data","English Shop"]){expect(html).toContain(text);}
    expect(html).not.toMatch(/Detected headers|>Ready<|>Warnings<|>Errors<|>IN_STOCK</);
  });
  it("renders successful import results and navigation in Ukrainian",()=>{
    state.values=[null,null,{},"shop",null,{imported:2,skipped:1,footerSkipped:1,duplicates:0,failed:0,failures:[]},"",false];
    const html=renderToStaticMarkup(React.createElement(InventoryImport,{employeeShopId:"shop",shops:[]}));
    for(const key of ["import.imported","import.validationSkipped","import.footerSkipped","import.databaseFailures","import.return","import.another"]){expect(html).toContain(createTranslator("ua")(key));}
    expect(html).toContain('href="/inventory"');
    expect(html).not.toMatch(/Validation errors skipped|Return to inventory|Import another file/);
  });
});
