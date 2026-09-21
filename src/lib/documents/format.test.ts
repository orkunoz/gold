import {describe,expect,it} from "vitest";
import {documentWeightUnit,formatDocumentDateTime} from "./format";

describe("document presentation formatters",()=>{
 it("uses one medium Ukrainian Kyiv timestamp for HTML and PDF renderers",()=>expect(formatDocumentDateTime("2026-09-20T13:39:00Z","ua").replace(/[\u00a0\u202f]/g," ")).toBe("20 вер. 2026 р., 16:39"));
 it("uses localized document weight units",()=>{expect(documentWeightUnit("ua")).toBe("г");expect(documentWeightUnit("en")).toBe("g")});
});
