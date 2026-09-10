import {describe,expect,it} from "vitest";
import {parseSalesRegisterFilters,productSummary,salesPresetRange,salesRegisterHref} from "./register";

describe("sales register filters",()=>{
  it("parses URL-backed shop, category, and page filters",()=>expect(parseSalesRegisterFilters({shop:" shop-2 ",category:"bracelet-id",page:"3"})).toEqual({shopId:"shop-2",category:"bracelet-id",page:3}));
  it("preserves filters during pagination",()=>expect(salesRegisterHref({shopId:"shop-2",category:"bracelet-id"},2)).toBe("/sales?shop=shop-2&category=bracelet-id&page=2"));
  it("clears to the unfiltered register",()=>expect(salesRegisterHref({shopId:null,category:null},1)).toBe("/sales"));
  it("formats one sale as a category summary",()=>expect(productSummary([{category:"Bracelet",count:2},{category:"Ring",count:1}])).toBe("Bracelet × 2, Ring × 1"));
  it("builds Ukraine-local date presets",()=>expect(salesPresetRange("last7",new Date("2026-09-10T12:00:00Z"))).toEqual({from:"2026-09-04",to:"2026-09-11"}));
});
