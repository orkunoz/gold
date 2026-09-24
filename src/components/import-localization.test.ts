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
  it("hides known unsupported legacy source columns from mapping",()=>{
    const parsed={selectedSheet:"Legacy",sheetNames:["Legacy"],headerRow:0,headers:["№ з/п","Виріб","Виробник","Розмір","Вага","Ціна-грам","Артикул","Примітка","Дата реалізації","Ціна(грн)"],rows:[[1,"Ring","Maker","17",2,"100","A-1","note","date",200]],sourceRows:[2],suggestedMapping:{category:1,producer:2,size:3,weight_grams:4,price_per_gram:5,article_number:6}};
    state.values=[{name:"legacy.xlsx"},parsed,parsed.suggestedMapping,"shop",null,null,"",false];
    const html=renderToStaticMarkup(React.createElement(InventoryImport,{employeeShopId:"shop",shops:[{id:"shop",name:"Warehouse",code:null}]}));
    for(const supported of ["Виріб","Виробник","Розмір","Вага","Ціна-грам","Артикул"])expect(html).toContain(supported);
    for(const unsupported of ["№ з/п","Примітка","Дата реалізації","Ціна(грн)"])expect(html).not.toContain(unsupported);
    expect(html).toContain('<option value="producer" selected="">Виробник</option>');
    expect(html).toContain('<option value="size" selected="">Розмір</option>');
    for(const target of ["category","article_number","producer","size","weight_grams","purchase_price","price_per_gram","barcode"])expect(html).toContain(`value="${target}"`);
    expect(html).toContain("xl:flex-nowrap");
  });
  it("renders preview labels in Ukrainian and leaves spreadsheet values intact",()=>{
    const parsed={selectedSheet:"Sheet One",sheetNames:["Sheet One"],headerRow:2,headers:["Original English Header"],rows:[["Original English Data"]],sourceRows:[4],suggestedMapping:{}};
    const preview={summary:{sourceRows:1,ready:1,warnings:0,errors:0,duplicates:0,ignoredRows:0},ignoredSourceRows:[],rows:[{sourceRow:4,classification:"Ready",errors:[],warnings:[],item:{category_name:"Original English Data",metal:null,producer:"Producer",status:"IN_STOCK"}}]};
    state.values=[{name:"items.xlsx"},parsed,{},"shop",preview,null,"",false];
    const html=renderToStaticMarkup(React.createElement(InventoryImport,{employeeShopId:"shop",shops:[{id:"shop",name:"English Shop",code:null}]}));
    for(const text of ["Заголовки виявлено в рядку 3","Рядок джерела","потребують уваги: 0","неможливо імпортувати: 0","Імпортувати 1 коректний виріб","В наявності","Original English Header","Original English Data"]){expect(html).toContain(text);}
    expect(html).not.toContain("Проігноровані рядки джерела:");
    expect(html).not.toMatch(/Detected headers|>Ready<|>Warnings<|>Errors<|>IN_STOCK</);
  });
  it("renders successful import results and navigation in Ukrainian",()=>{
    state.values=[null,null,{},"shop",null,{imported:2,skipped:1,ignoredRows:1,duplicates:0,failed:0,failures:[]},"",false];
    const html=renderToStaticMarkup(React.createElement(InventoryImport,{employeeShopId:"shop",shops:[]}));
    for(const key of ["import.imported","import.validationSkipped","import.ignoredRows","import.databaseFailures","import.return","import.another"]){expect(html).toContain(createTranslator("ua")(key));}
    expect(html).toContain('href="/inventory"');
    expect(html).not.toMatch(/Validation errors skipped|Return to inventory|Import another file/);
  });
});
