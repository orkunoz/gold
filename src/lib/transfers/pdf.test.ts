import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "@/lib/i18n/core";
vi.mock("server-only",()=>({}));
import { transferPdf, transferPdfFilename } from "./pdf";

const transfer={transfer_number:"TR-20260913-000123",transferred_at:"2026-09-13T12:00:00Z",source_name:"Склад",destination_name:"Камінь",source_address:"вул. Центральна, 1",destination_address:null,performed_by_name:"Власник",total_weight:2.5,total_value:38320};
const items=[{line_number:1,category_name:"Каблучка",article_number:"А-1",producer:"Україна",size:"17",weight_grams:2.5,purchase_price:20000,price_per_gram:15328,price:38320,barcode:"123456"}];

describe("transfer PDF",()=>{
  it("creates a valid single-page A4 PDF with an embedded Unicode font",()=>{
    const pdf=transferPdf(transfer,items);
    expect(pdf.subarray(0,8).toString()).toBe("%PDF-1.7");
    expect(pdf.subarray(-5).toString()).toBe("%%EOF");
    expect(pdf.toString("latin1")).toContain("/MediaBox [0 0 595 842]");
    expect(pdf.toString("latin1")).toContain("/FontFile2");
    expect(pdf.byteLength).toBeGreaterThan(readFileSync("public/fonts/geist-regular.ttf").byteLength);
    expect(pdf.toString("latin1").match(/ re [fS]/g)?.length).toBeGreaterThan(12);
  });
  it("paginates long transfers and repeats a real bordered table",()=>{
    const many=Array.from({length:70},(_,index)=>({...items[0],line_number:index+1,category_name:`Каблучка ${index+1}`}));
    const pdf=transferPdf(transfer,many),source=pdf.toString("latin1");
    expect(source).toContain("/Count 3");
    expect(source.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(source.match(/ re S/g)?.length).toBeGreaterThan(700);
  });
  it("uses a stable meaningful filename",()=>expect(transferPdfFilename(transfer.transfer_number)).toBe("transfer-000123.pdf"));
  it("has localized UA and EN confirmation labels without placeholders",()=>{
    for(const locale of ["ua","en"] as const){const t=createTranslator(locale);expect(t("inventory.bulk.deleteTitle",{count:12})).not.toContain("{count}");expect(t("common.cancel")).not.toMatch(/^common\./);expect(t("inventory.deletePermanently")).not.toMatch(/^inventory\./)}
  });
});
