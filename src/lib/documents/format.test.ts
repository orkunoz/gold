import {describe,expect,it} from "vitest";
import {documentWeightUnit,formatDocumentDateTime,formatDocumentPrice,formatDocumentTotalPrice} from "./format";

describe("document presentation formatters",()=>{
 it("uses one medium Ukrainian Kyiv timestamp for HTML and PDF renderers",()=>expect(formatDocumentDateTime("2026-09-20T13:39:00Z","ua").replace(/[\u00a0\u202f]/g," ")).toBe("20 вер. 2026 р., 16:39"));
 it("uses localized document weight units",()=>{expect(documentWeightUnit("ua")).toBe("г");expect(documentWeightUnit("en")).toBe("g")});
 it("uses the hryvnia symbol in Ukrainian generated-document prices",()=>{
  expect(formatDocumentPrice(1200,"ua").replace(/[\u00a0\u202f]/g," ")).toBe("1 200,00 ₴");
  expect(formatDocumentTotalPrice(-0.001,"ua")).toBe("0,00 ₴");
  expect(formatDocumentPrice(null,"ua")).toBe("—");
 });
 it("keeps English table and total conventions distinct",()=>{
  expect(formatDocumentPrice(1200,"en")).toBe("1,200.00");
  expect(formatDocumentTotalPrice(1200,"en")).toContain("UAH");
 });
});
