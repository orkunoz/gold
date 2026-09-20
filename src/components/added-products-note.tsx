/* eslint-disable @next/next/no-img-element */
import {TRANSFER_NOTE_CSS} from "./transfer-note";

export type AddedProductsDocument={document_number:string;created_at:string;created_by_name:string;location_names:string[];product_count:number;total_weight:number;total_value:number};
export type AddedProductsItem={id?:string;line_number:number;category_name:string;article_number:string|null;producer:string;size:string|null;weight_grams:number;price_per_gram:number;price:number;location_name:string;barcode:string|null};
export type AddedProductsLabels={title:string;number:string;date:string;locations:string;products:string;totalWeight:string;totalValue:string;createdBy:string;signature:string;headings:string[];location:(value:string)=>string};
const display=(value:unknown)=>value===null||value===undefined||value===""?"—":String(value);
const RECEIPT_CSS=String.raw`
.added-products-note .transfer-note__locations{grid-template-columns:1fr}
.added-products-note .transfer-note__location{min-height:auto}
.added-products-note .transfer-note__table{font-size:9px}
.added-products-note .transfer-note__table th{font-size:8px}
.added-products-note .transfer-note__table th,.added-products-note .transfer-note__table td{padding:5px 4px}
.added-products-note .transfer-note__table th:nth-child(1){width:4%}
.added-products-note .transfer-note__table th:nth-child(2){width:13%}
.added-products-note .transfer-note__table th:nth-child(3){width:9%}
.added-products-note .transfer-note__table th:nth-child(4){width:11%}
.added-products-note .transfer-note__table th:nth-child(5){width:5%}
.added-products-note .transfer-note__table th:nth-child(6){width:7%}
.added-products-note .transfer-note__table th:nth-child(7){width:11%}
.added-products-note .transfer-note__table th:nth-child(8){width:10%}
.added-products-note .transfer-note__table th:nth-child(9){width:12%}
.added-products-note .transfer-note__table th:nth-child(10){width:18%}
.added-products-note .transfer-note__table td:nth-child(5),.added-products-note .transfer-note__table td:nth-child(6),.added-products-note .transfer-note__table td:nth-child(7),.added-products-note .transfer-note__table td:nth-child(8){white-space:nowrap;overflow-wrap:normal}
.added-products-note .transfer-note__table th:nth-child(10),.added-products-note .transfer-note__table td:nth-child(10){min-width:32mm;overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere;word-break:break-all;font-variant-numeric:tabular-nums}
.added-products-note .transfer-note__summary{grid-template-columns:repeat(3,1fr)}
`;

export function AddedProductsNote({document,items,labels,locale,logoSrc}:{document:AddedProductsDocument;items:AddedProductsItem[];labels:AddedProductsLabels;locale:"ua"|"en";logoSrc:string}){
 const language=locale==="ua"?"uk-UA":"en-US",number=new Intl.NumberFormat(language,{maximumFractionDigits:3}),money=new Intl.NumberFormat(language,{style:"currency",currency:"UAH"}),dateTime=(value:string)=>new Intl.DateTimeFormat(language,{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Kyiv"}).format(new Date(value));
 return <><style dangerouslySetInnerHTML={{__html:TRANSFER_NOTE_CSS+RECEIPT_CSS}}/><article className="transfer-note added-products-note" lang={locale==="ua"?"uk":"en"}>
  <header className="transfer-note__header"><img className="transfer-note__logo" src={logoSrc} alt="Zlata Jewelry"/><h1 className="transfer-note__heading">{labels.title}</h1><div className="transfer-note__meta"><strong>{labels.number}: <span className="transfer-note__number">{document.document_number}</span></strong><span>{labels.date}: {dateTime(document.created_at)}</span></div></header>
  <section className="transfer-note__locations"><div className="transfer-note__location"><span className="transfer-note__location-label">{labels.locations}</span><strong className="transfer-note__location-name">{document.location_names.map(labels.location).join(", ")}</strong></div></section>
  <div className="transfer-note__table-wrap"><table className="transfer-note__table"><thead><tr>{labels.headings.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{items.map(x=><tr key={x.id??x.line_number}>{[x.line_number,x.category_name,x.article_number,x.producer,x.size,number.format(x.weight_grams),money.format(x.price_per_gram),money.format(x.price),labels.location(x.location_name),x.barcode].map((v,i)=><td key={i}>{display(v)}</td>)}</tr>)}</tbody></table></div>
  <section className="transfer-note__summary"><div><span>{labels.products}</span><strong>{document.product_count}</strong></div><div><span>{labels.totalWeight}</span><strong>{number.format(document.total_weight)} g</strong></div><div><span>{labels.totalValue}</span><strong>{money.format(document.total_value)}</strong></div></section>
  <p className="transfer-note__performed"><strong>{labels.createdBy}:</strong> {document.created_by_name}</p><section className="transfer-note__signatures"><div className="transfer-note__signature">{labels.signature}</div></section>
 </article></>;
}
