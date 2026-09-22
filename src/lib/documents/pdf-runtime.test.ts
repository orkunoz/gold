import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it,vi} from "vitest";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

vi.mock("server-only",()=>({}));

import {createTranslator} from "@/lib/i18n/core";
import {transferHtml,transferPdf} from "@/lib/transfers/pdf";
import {transferNoteLabels} from "@/lib/transfers/labels";
import {addedProductsHtml,addedProductsPdf} from "@/lib/added-products/pdf";
import {addedProductsLabels} from "@/lib/added-products/labels";

const transfer={transfer_number:"TR-20260922-000001",transferred_at:"2026-09-22T12:00:00Z",source_name:"Склад",destination_name:"Горохів",source_address:null,destination_address:null,performed_by_name:"admin",item_count:4,total_weight:24.24,total_value:338943};
const receipt={document_number:"GR-20260922-000001",created_at:"2026-09-22T12:00:00Z",created_by_name:"admin",location_names:["Warehouse","Horokhiv"],product_count:4,total_weight:24.24,total_value:338943};
const rows=[
 {line_number:1,category_name:"Перстень діаманти (0,05ct)",article_number:"shmfpD600040|R55",producer:"Золотий Соверен",size:"17,5-18,5",weight_grams:12.12,price_per_gram:2131,price:262113,barcode:"12345678901234567890"},
 {line_number:2,category_name:"Каблучка",article_number:"asd",producer:"TestProducer B",size:"17",weight_grams:5,price_per_gram:8000,price:40000,barcode:"4820001234567"},
 {line_number:3,category_name:"Підвіска",article_number:"Q-3",producer:"Майстер",size:"18",weight_grams:4,price_per_gram:24390,price:23441,barcode:"5901234123457"},
 {line_number:4,category_name:"Браслет",article_number:"R-4",producer:"TestProducer C",size:"19",weight_grams:3.12,price_per_gram:4200,price:13389,barcode:"1234567890123"},
];

async function inspectPrintedHtml(html:string){
 const localChrome=[process.env.PUPPETEER_EXECUTABLE_PATH,join(process.env.PROGRAMFILES??"","Google/Chrome/Application/chrome.exe"),join(process.env["PROGRAMFILES(X86)"]??"","Microsoft/Edge/Application/msedge.exe")].find(path=>path&&existsSync(path));
 const browser=await puppeteer.launch({executablePath:localChrome??await chromium.executablePath(),args:localChrome?["--no-sandbox","--disable-dev-shm-usage"]:chromium.args,headless:"shell"});
 try{
  const page=await browser.newPage();
  await page.setContent(html,{waitUntil:"load"});
  await page.emulateMediaType("print");
  return await page.evaluate(async()=>({
   total:document.querySelector(".transfer-note__summary div:last-child strong")?.textContent,
   label:document.querySelector(".transfer-note__summary div:last-child span")?.textContent,
   currencyFontLoaded:(await document.fonts.load('12px "Zlata Currency"',"₴")).length>0,
   prices:[...document.querySelectorAll<HTMLTableCellElement>("tbody td.transfer-note__cell--price-per-gram,tbody td.transfer-note__cell--price")].map(cell=>({text:cell.textContent,align:getComputedStyle(cell).textAlign})),
  }));
 }finally{await browser.close()}
}

function saveForVisualReview(name:string,bytes:Uint8Array){
 const output=process.env.PDF_RENDER_OUTPUT_DIR;
 if(!output)return;
 mkdirSync(output,{recursive:true});
 writeFileSync(join(output,name),bytes);
}

describe.skipIf(process.env.VERIFY_PDF_RENDER!=="1")("generated Ukrainian PDF runtime",()=>{
 it("renders Transfer Note totals and right-aligned body prices in print mode",async()=>{
  const labels=transferNoteLabels(createTranslator("ua"));
  const rendered=await inspectPrintedHtml(await transferHtml(transfer,rows,labels,"ua"));
  expect(rendered.label).toBe("Загальна вартість");
  expect(rendered.total?.replace(/[\u00a0\u202f]/g," ")).toBe("338 943,00 ₴");
  expect(rendered.currencyFontLoaded).toBe(true);
  expect(rendered.prices).toHaveLength(8);
  expect(rendered.prices.every(cell=>cell.align==="right"&&cell.text?.endsWith(" ₴"))).toBe(true);
  const pdf=await transferPdf(transfer,rows,labels,"ua");
  expect(Buffer.from(pdf.subarray(0,5)).toString()).toBe("%PDF-");
  saveForVisualReview("transfer-ua-runtime.pdf",pdf);
 });
 it("renders Goods Receipt totals and right-aligned body prices in print mode",async()=>{
  const labels=addedProductsLabels(createTranslator("ua"),"ua");
  const items=rows.map((row,index)=>({...row,location_name:index%2?"Horokhiv":"Warehouse"}));
  const rendered=await inspectPrintedHtml(await addedProductsHtml(receipt,items,labels,"ua"));
  expect(rendered.label).toBe("Загальна вартість");
  expect(rendered.total?.replace(/[\u00a0\u202f]/g," ")).toBe("338 943,00 ₴");
  expect(rendered.currencyFontLoaded).toBe(true);
  expect(rendered.prices).toHaveLength(8);
  expect(rendered.prices.every(cell=>cell.align==="right"&&cell.text?.endsWith(" ₴"))).toBe(true);
  const pdf=await addedProductsPdf(receipt,items,labels,"ua");
  expect(Buffer.from(pdf.subarray(0,5)).toString()).toBe("%PDF-");
  saveForVisualReview("receipt-ua-runtime.pdf",pdf);
 });
});
