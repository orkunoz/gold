import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { transferHtml, transferPdf, transferPdfFilename } from "./pdf";

const transfer={transfer_number:"TR-20260913-000123",transferred_at:"2026-09-13T12:00:00Z",source_name:"Склад",destination_name:"Камінь",source_address:"вул. Центральна, 1",destination_address:null,performed_by_name:"admin",item_count:1,total_weight:2.5,total_value:38320};
const items=[{line_number:1,category_name:"Каблучка",article_number:"А-1",producer:"Україна",size:"17",weight_grams:2.5,price_per_gram:15328,price:38320,barcode:"123456"}];
const labels={title:"Накладна переміщення",number:"№ документа",date:"Дата створення",from:"Звідки",to:"Куди",itemCount:"Вироби",totalWeight:"Загальна вага",totalValue:"Загальна вартість",performedBy:"Створив",sender:"Передав",receiver:"Прийняв",headings:["№","Виріб","Артикул","Виробник","Розмір","Вага","Ціна за грам","Ціна (грн)","Штрихкод"]};

describe("transfer PDF",()=>{
  it("renders safe canonical Ukrainian HTML with print pagination rules",async()=>{const html=await transferHtml(transfer,items,labels,"ua");expect(html).toContain('lang="uk"');expect(html).toContain("Дата створення");expect(html).toContain("Створив");expect(html).toContain("admin");expect(html).not.toContain("Створив / виконав");expect(html).not.toContain("Ціна закупки");expect(html).toContain("data:image/png;base64,");expect(html).toContain("@page{size:A4 portrait");expect(html).toContain("display:table-header-group");expect(html).toContain("page-break-inside:avoid")});
  it.skipIf(process.env.CI)("creates a valid A4 PDF from the canonical HTML in local headless Chromium",async()=>{const pdf=await transferPdf(transfer,items,labels,"ua");expect(Buffer.from(pdf.subarray(0,5)).toString()).toBe("%PDF-");expect(pdf.byteLength).toBeGreaterThan(10_000)});
  it("uses the complete transfer number in a meaningful filename",()=>expect(transferPdfFilename(transfer.transfer_number)).toBe("transfer-TR-20260913-000123.pdf"));
});
