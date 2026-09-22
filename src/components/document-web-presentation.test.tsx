import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {AddedProductsNote} from "./added-products-note";
import {TransferNote} from "./transfer-note";
import {addedProductsInAppLabels} from "@/lib/added-products/labels";
import {createTranslator} from "@/lib/i18n/core";
import {formatTablePrice} from "@/lib/inventory/format";
import {transferInAppLabels} from "@/lib/transfers/labels";

const t=createTranslator("ua"),presentation={formatPrice:(value:number|null)=>formatTablePrice(value,"ua"),formatWeight:(value:number)=>`${new Intl.NumberFormat("uk-UA",{maximumFractionDigits:3}).format(value)} г`};

describe("in-app document presentation",()=>{
 it("keeps the accepted Transfer Note composition while using ₴ and г",()=>{
  const html=renderToStaticMarkup(<TransferNote transfer={{transfer_number:"TR-1",transferred_at:"2026-09-20T13:39:00Z",source_name:"Склад",destination_name:"Камінь",source_address:null,destination_address:null,performed_by_name:"admin",item_count:1,total_weight:125,total_value:266375}} items={[{line_number:1,category_name:"Каблучка",article_number:"A-1",producer:"Zlata",size:"17",weight_grams:125,price_per_gram:2131,price:266375,barcode:"123"}]} labels={transferInAppLabels(t)} locale="ua" logoSrc="/logoZlataBrown.png" presentation={presentation}/>).replace(/[\u00a0\u202f]/g," ");
  expect(html).toContain('class="transfer-note transfer-note--ua-table"');
  expect(html).toContain('class="transfer-note__header"');
  expect(html).toContain('class="transfer-note__summary"');
  for(const value of["Ціна за грам","Ціна","Загальна вартість","2 131,00 ₴","266 375,00 ₴","125 г"])expect(html).toContain(value);
  expect(html).not.toContain("Ціна/г, грн");
  expect(html).not.toContain("Загальна вартість, грн");
 });

 it("keeps the accepted Goods Receipt composition while using ₴ and г",()=>{
  const html=renderToStaticMarkup(<AddedProductsNote document={{document_number:"GR-1",created_at:"2026-09-20T13:39:00Z",created_by_name:"admin",location_names:["Склад"],product_count:1,total_weight:125,total_value:266375}} items={[{line_number:1,category_name:"Каблучка",article_number:"A-1",producer:"Zlata",size:"17",weight_grams:125,price_per_gram:2131,price:266375,location_name:"Склад",barcode:"123"}]} labels={addedProductsInAppLabels(t,"ua")} locale="ua" logoSrc="/logoZlataBrown.png" presentation={presentation}/>).replace(/[\u00a0\u202f]/g," ");
  expect(html).toContain('class="transfer-note added-products-note transfer-note--ua-table"');
  expect(html).toContain('class="transfer-note__locations"');
  expect(html).toContain('class="transfer-note__summary"');
  for(const value of["Ціна за грам","Ціна","Загальна вартість","2 131,00 ₴","266 375,00 ₴","125 г"])expect(html).toContain(value);
  expect(html).not.toContain("Ціна/г, грн");
  expect(html).not.toContain("Загальна вартість, грн");
 });
});
