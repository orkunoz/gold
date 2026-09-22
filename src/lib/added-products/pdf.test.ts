import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {createTranslator} from "@/lib/i18n/core";
import {addedProductsHtml,addedProductsPdf,addedProductsPdfFilename} from "./pdf";
import {addedProductsLabels} from "./labels";

const document={document_number:"GR-20260920-000012",created_at:"2026-09-20T13:39:00Z",created_by_name:"admin",location_names:["Novovolynsk","Warehouse"],product_count:2,total_weight:24.24,total_value:591214};
const items=[
 {line_number:1,category_name:"Перстень діаманти (0,05ct)",article_number:"shmfpD600040|R55",producer:"Золотий Соверен",size:"17,5-18,5",weight_grams:12.12,price_per_gram:24390,price:295607,location_name:"Novovolynsk",barcode:"12345678901234567890"},
 {line_number:2,category_name:"Каблучка",article_number:"asd",producer:"TestProducer B",size:"17",weight_grams:12.12,price_per_gram:24390,price:295607,location_name:"Warehouse",barcode:"4820001234567"},
];
const normalize=(value:string)=>value.replace(/[\u00a0\u202f]/g," ").replaceAll("<!-- -->","");

describe("Added Products PDF",()=>{
 it("uses shared Ukrainian date, weight, total-label, and numeric formatting",async()=>{
  const html=normalize(await addedProductsHtml(document,items,addedProductsLabels(createTranslator("ua"),"ua"),"ua"));
  expect(html).toContain("Дата створення: 20 вер. 2026 р., 16:39");
  expect(html).toContain("Загальна вага</span><strong>24,24 г</strong>");
  expect(html).toContain("Загальна вартість</span><strong>591 214,00 ₴</strong>");
  expect(html).toContain("transfer-note--ua-table .transfer-note__table td.transfer-note__cell--price-per-gram,.transfer-note--ua-table .transfer-note__table td.transfer-note__cell--price{text-align:right}");
  expect(html).not.toContain("грн");
 });

 it.each(["en","ua"] as const)("uses localized boundary prices and concise %s headers",async locale=>{
  const html=normalize(await addedProductsHtml(document,items,addedProductsLabels(createTranslator(locale),locale),locale)),priceCells=[...html.matchAll(/<td class="transfer-note__cell--price(?:-per-gram)?">([^<]+)<\/td>/g)].map(match=>match[1]);
  if(locale==="en")expect(html).toContain('transfer-note__heading-main">Price per Gram</span><span class="transfer-note__heading-unit">(UAH)');
  else{expect(html).toContain('transfer-note__heading-main">Ціна/г</span>');expect(html).toContain('transfer-note__heading-main">Ціна</span>')}
  expect(priceCells.slice(0,2)).toEqual(locale==="en"?["24,390.00","295,607.00"]:["24 390,00 ₴","295 607,00 ₴"]);
  if(locale==="ua")expect(priceCells).toHaveLength(4);
  expect(priceCells.join(" ")).not.toMatch(/UAH|грн/);
 });

 it("uses content-aware receipt columns for long boundaries and short-article contrast",async()=>{
  const html=normalize(await addedProductsHtml(document,items,addedProductsLabels(createTranslator("ua"),"ua"),"ua"));
  for(const value of["Перстень діаманти (0,05ct)","shmfpD600040|R55","Золотий Соверен","17,5-18,5","Нововолинськ","12345678901234567890","asd","TestProducer B","24 390,00 ₴","295 607,00 ₴"])expect(html).toContain(value);
  for(const rule of['article class="transfer-note added-products-note transfer-note--ua-table"',"added-products-note.transfer-note--ua-table .transfer-note__table{table-layout:auto","added-products-note.transfer-note--ua-table .transfer-note__col--category,.added-products-note.transfer-note--ua-table .transfer-note__col--article,.added-products-note.transfer-note--ua-table .transfer-note__col--producer,.added-products-note.transfer-note--ua-table .transfer-note__col--location,.added-products-note.transfer-note--ua-table .transfer-note__col--barcode{width:auto}","added-products-note.transfer-note--ua-table .transfer-note__col--nr,.added-products-note.transfer-note--ua-table .transfer-note__col--size,.added-products-note.transfer-note--ua-table .transfer-note__col--weight,.added-products-note.transfer-note--ua-table .transfer-note__col--price-per-gram,.added-products-note.transfer-note--ua-table .transfer-note__col--price{width:1%}","transfer-note--ua-table .transfer-note__cell--barcode{white-space:nowrap","transfer-note__cell--barcode transfer-note__cell--long-id"])expect(html).toContain(rule);
  expect(html).not.toMatch(/added-products-note\.transfer-note--ua-table \.transfer-note__col--(?:category|article|producer|location|barcode)\{width:\d/);
  expect(html).not.toContain("text-overflow:ellipsis");
  expect(html).not.toContain("word-break:break-all");
  for(const confidential of["Purchase Price","Purchase Value","IN_STOCK","2026-09-19T09:00:00Z"])expect(html).not.toContain(confidential);
 });

 it.skipIf(process.env.CI)("creates a valid PDF with Cyrillic content in local Chromium",async()=>{const pdf=await addedProductsPdf(document,items,addedProductsLabels(createTranslator("ua"),"ua"),"ua");expect(Buffer.from(pdf.subarray(0,5)).toString()).toBe("%PDF-");expect(pdf.byteLength).toBeGreaterThan(10_000)});
 it("uses the immutable document number in the filename",()=>expect(addedProductsPdfFilename(document.document_number)).toBe("goods-receipt-GR-20260920-000012.pdf"));
});
