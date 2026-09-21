import {describe,expect,it} from "vitest";
import {formatPrice,formatTablePrice} from "./format";

const normalizeSpaces=(value:string)=>value.replace(/[\u00a0\u202f]/g," ");

describe("table price formatting",()=>{
 it("renders Ukrainian currency-column values as locale-formatted numbers only",()=>{
  expect(normalizeSpaces(formatTablePrice(40000,"ua"))).toBe("40 000,00");
  expect(formatTablePrice(40000,"ua")).not.toMatch(/грн|₴/u);
 });
 it("preserves the existing English currency presentation",()=>expect(formatTablePrice(40000,"en")).toBe(formatPrice(40000,"en")));
 it("preserves empty and negative-zero handling",()=>{
  expect(formatTablePrice(null,"ua")).toBe("—");
  expect(normalizeSpaces(formatTablePrice(-0.001,"ua"))).toBe("0,00");
 });
});
