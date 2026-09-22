import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {translate} from "@/lib/i18n/core";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("sale number terminology",()=>{
 it("uses Sale Nr and № продажу for the shared visible heading",()=>{
  expect(translate("en","sales.saleId")).toBe("Sale Nr");
  expect(translate("ua","sales.saleId")).toBe("№ продажу");
 });
 it("uses that heading for sale_number in Recent Sales and Sales History",()=>{
  for(const path of ["../app/(protected)/dashboard/page.tsx","../app/(protected)/sales/page.tsx"]){
   const source=read(path);
   expect(source).toContain('t("sales.saleId")');
   expect(source).toContain("{sale.sale_number}");
  }
 });
});
