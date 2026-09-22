import {describe,expect,it} from "vitest";
import {formatDashboardPrice,formatPrice,formatTablePrice} from "./format";

const normalizeSpaces=(value:string)=>value.replace(/[\u00a0\u202f]/g," ");

describe("table price formatting",()=>{
 it("renders Ukrainian operational values with the hryvnia symbol",()=>{
  expect(normalizeSpaces(formatTablePrice(40000,"ua"))).toBe("40 000,00 ₴");
 });
 it("places UAH after English values with comma grouping and decimal points",()=>{
  expect(formatTablePrice(40000,"en")).toBe("40,000.00 UAH");
  expect(formatDashboardPrice(266375,"en")).toBe("266,375.00 UAH");
  expect(formatPrice(-0.001,"en")).toBe("0.00 UAH");
 });
 it("preserves empty and negative-zero handling",()=>{
  expect(formatTablePrice(null,"ua")).toBe("—");
  expect(normalizeSpaces(formatTablePrice(-0.001,"ua"))).toBe("0,00 ₴");
 });
 it("renders Ukrainian Dashboard KPI values with the грн suffix",()=>expect(normalizeSpaces(formatDashboardPrice(266375,"ua"))).toBe("266 375,00 грн"));
});
