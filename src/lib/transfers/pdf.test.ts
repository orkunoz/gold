import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {createTranslator} from "@/lib/i18n/core";
import {transferHtml,transferPdf,transferPdfFilename} from "./pdf";
import {transferNoteLabels} from "./labels";

const transfer={transfer_number:"TR-20260920-000012",transferred_at:"2026-09-20T13:39:00Z",source_name:"Склад",destination_name:"Камінь",source_address:"вул. Центральна, 1",destination_address:null,performed_by_name:"admin",item_count:2,total_weight:24.24,total_value:591214};
const items=[
 {line_number:1,category_name:"Перстень діаманти (0,05ct)",article_number:"shmfpD600040|R55",producer:"Золотий Соверен",size:"17,5-18,5",weight_grams:12.12,price_per_gram:24390,price:295607,barcode:"12345678901234567890"},
 {line_number:2,category_name:"Каблучка",article_number:"asd",producer:"TestProducer B",size:"17",weight_grams:12.12,price_per_gram:24390,price:295607,barcode:"4820001234567"},
];
const normalize=(value:string)=>value.replace(/[\u00a0\u202f]/g," ").replaceAll("<!-- -->","");

describe("transfer PDF",()=>{
 it("renders safe canonical Ukrainian HTML with shared presentation formatting",async()=>{
  const html=normalize(await transferHtml(transfer,items,transferNoteLabels(createTranslator("ua")),"ua"));
  expect(html).toContain('lang="uk"');
  expect(html).toContain("Дата створення: 20 вер. 2026 р., 16:39");
  expect(html).toContain("Загальна вага</span><strong>24,24 г</strong>");
  expect(html).toContain("Загальна вартість</span><strong>591 214,00 ₴</strong>");
  expect(html).not.toContain("грн");
  expect(html).toContain("Створив");
  expect(html).toContain("admin");
  expect(html).not.toContain("Створив / виконав");
  expect(html).not.toContain("Ціна закупки");
  expect(html).toContain("data:image/png;base64,");
  expect(html).toContain("@page{size:A4 portrait");
  expect(html).toContain("display:table-header-group");
  expect(html).toContain("page-break-inside:avoid");
 });

 it("shows both locations, preserves a real address, and omits the empty-address dash",async()=>{
  const html=await transferHtml(transfer,items,transferNoteLabels(createTranslator("ua")),"ua"),locations=html.slice(html.indexOf('class="transfer-note__locations"'),html.indexOf('class="transfer-note__table-wrap"'));
  expect(locations).toContain("Склад");
  expect(locations).toContain("Камінь");
  expect(locations).toContain("вул. Центральна, 1");
  expect(locations).not.toContain("—");
 });

 it.each(["en","ua"] as const)("uses localized boundary prices and concise %s headers",async locale=>{
  const html=normalize(await transferHtml(transfer,items,transferNoteLabels(createTranslator(locale)),locale)),priceCells=[...html.matchAll(/<td class="transfer-note__cell--price(?:-per-gram)?">([^<]+)<\/td>/g)].map(match=>match[1]);
  if(locale==="en")expect(html).toContain('transfer-note__heading-main">Price per Gram</span><span class="transfer-note__heading-unit">(UAH)');
  else{expect(html).toContain('transfer-note__heading-main">Ціна/г</span>');expect(html).toContain('transfer-note__heading-main">Ціна</span>')}
  expect(priceCells.slice(0,2)).toEqual(locale==="en"?["24,390.00","295,607.00"]:["24 390,00 ₴","295 607,00 ₴"]);
  expect(priceCells.join(" ")).not.toMatch(/UAH|грн/);
 });

 it("uses content-aware Ukrainian columns for long boundaries and short-article contrast",async()=>{
  const html=normalize(await transferHtml(transfer,items,transferNoteLabels(createTranslator("ua")),"ua"));
  for(const value of["Перстень діаманти (0,05ct)","shmfpD600040|R55","Золотий Соверен","17,5-18,5","12345678901234567890","asd","TestProducer B","24 390,00 ₴","295 607,00 ₴"])expect(html).toContain(value);
  for(const rule of['article class="transfer-note transfer-note--ua-table"',"transfer-note--ua-table .transfer-note__table{table-layout:auto","transfer-note--ua-table .transfer-note__col--category,.transfer-note--ua-table .transfer-note__col--article,.transfer-note--ua-table .transfer-note__col--producer,.transfer-note--ua-table .transfer-note__col--barcode{width:auto}","transfer-note--ua-table .transfer-note__col--nr,.transfer-note--ua-table .transfer-note__col--size,.transfer-note--ua-table .transfer-note__col--weight,.transfer-note--ua-table .transfer-note__col--price-per-gram,.transfer-note--ua-table .transfer-note__col--price{width:1%}","td.transfer-note__cell--article{white-space:nowrap","transfer-note--ua-table .transfer-note__cell--barcode{white-space:nowrap","transfer-note__cell--barcode transfer-note__cell--long-id"] )expect(html).toContain(rule);
  expect(html).not.toMatch(/transfer-note--ua-table \.transfer-note__col--(?:category|article|producer|barcode)\{width:\d/);
  expect(html).not.toContain("text-overflow:ellipsis");
  expect(html).not.toContain("word-break:break-all");
 });

 it.skipIf(process.env.CI)("creates a valid A4 PDF from the canonical HTML in local headless Chromium",async()=>{const pdf=await transferPdf(transfer,items,transferNoteLabels(createTranslator("ua")),"ua");expect(Buffer.from(pdf.subarray(0,5)).toString()).toBe("%PDF-");expect(pdf.byteLength).toBeGreaterThan(10_000)});
 it("uses the complete transfer number in a meaningful filename",()=>expect(transferPdfFilename(transfer.transfer_number)).toBe("transfer-TR-20260920-000012.pdf"));
});
