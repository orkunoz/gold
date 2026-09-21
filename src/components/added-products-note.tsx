/* eslint-disable @next/next/no-img-element */
import {DocumentTableHeading,TRANSFER_NOTE_CSS} from "./transfer-note";

export type AddedProductsDocument={document_number:string;created_at:string;created_by_name:string;location_names:string[];product_count:number;total_weight:number;total_value:number};
export type AddedProductsItem={id?:string;line_number:number;category_name:string;article_number:string|null;producer:string;size:string|null;weight_grams:number;price_per_gram:number;price:number;location_name:string;barcode:string|null};
export type AddedProductsLabels={title:string;number:string;date:string;locations:string;products:string;totalWeight:string;totalValue:string;createdBy:string;signature:string;headings:string[];location:(value:string)=>string};
const display=(value:unknown)=>value===null||value===undefined||value===""?"—":String(value);
const RECEIPT_CSS=String.raw`
.added-products-note .transfer-note__locations{grid-template-columns:1fr}
.added-products-note .transfer-note__location{min-height:auto}
.added-products-note .transfer-note__table{font-size:12px}
.added-products-note .transfer-note__table th{font-size:13px}
.added-products-note .transfer-note__table th,.added-products-note .transfer-note__table td{padding:5px 4px}
.added-products-note .transfer-note__col--nr{width:3%}
.added-products-note .transfer-note__col--category{width:11.5%}
.added-products-note .transfer-note__col--article{width:8%}
.added-products-note .transfer-note__col--producer{width:10%}
.added-products-note .transfer-note__col--size{width:7.5%}
.added-products-note .transfer-note__col--weight{width:6.5%}
.added-products-note .transfer-note__col--price-per-gram{width:16%}
.added-products-note .transfer-note__col--price{width:15%}
.added-products-note .transfer-note__col--location{width:9%}
.added-products-note .transfer-note__col--barcode{width:13.5%}
.added-products-note .transfer-note__cell--location{overflow-wrap:break-word}
.added-products-note .transfer-note__summary{grid-template-columns:repeat(3,1fr)}
.added-products-note.transfer-note--compact-table .transfer-note__table th{font-size:10.5px}
@media print{.added-products-note.transfer-note--compact-table .transfer-note__table th{font-size:8pt}.added-products-note.transfer-note--compact-table .transfer-note__signatures{margin-top:8mm;padding-bottom:0}}
`;

export const ADDED_PRODUCTS_COLUMNS=["nr","category","article","producer","size","weight","price-per-gram","price","location","barcode"] as const;

export function AddedProductsNote({document,items,labels,locale,logoSrc}:{document:AddedProductsDocument;items:AddedProductsItem[];labels:AddedProductsLabels;locale:"ua"|"en";logoSrc:string}){
 const language=locale==="ua"?"uk-UA":"en-US",number=new Intl.NumberFormat(language,{maximumFractionDigits:3}),priceNumber=new Intl.NumberFormat(language,{minimumFractionDigits:2,maximumFractionDigits:2}),money=new Intl.NumberFormat(language,{style:"currency",currency:"UAH"}),dateTime=(value:string)=>new Intl.DateTimeFormat(language,{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Kyiv"}).format(new Date(value));
 const compact=items.some(item=>[item.category_name,item.article_number,item.producer,item.location_name,item.barcode].some(value=>(value?.length??0)>22)||String(item.price_per_gram).length>12||String(item.price).length>12);
 return <><style dangerouslySetInnerHTML={{__html:TRANSFER_NOTE_CSS+RECEIPT_CSS}}/><article className={`transfer-note added-products-note${compact?" transfer-note--compact-table":""}`} lang={locale==="ua"?"uk":"en"}>
  <header className="transfer-note__header"><img className="transfer-note__logo" src={logoSrc} alt="Zlata Jewelry"/><h1 className="transfer-note__heading">{labels.title}</h1><div className="transfer-note__meta"><strong>{labels.number}: <span className="transfer-note__number">{document.document_number}</span></strong><span>{labels.date}: {dateTime(document.created_at)}</span></div></header>
  <section className="transfer-note__locations"><div className="transfer-note__location"><span className="transfer-note__location-label">{labels.locations}</span><strong className="transfer-note__location-name">{document.location_names.map(labels.location).join(", ")}</strong></div></section>
  <div className="transfer-note__table-wrap"><table className="transfer-note__table"><colgroup>{ADDED_PRODUCTS_COLUMNS.map(column=><col key={column} className={`transfer-note__col--${column}`}/>)}</colgroup><thead><tr>{labels.headings.map((heading,index)=><th key={heading} className={`transfer-note__cell--${ADDED_PRODUCTS_COLUMNS[index]}`}><DocumentTableHeading heading={heading}/></th>)}</tr></thead><tbody>{items.map(x=><tr key={x.id??x.line_number}>{[x.line_number,x.category_name,x.article_number,x.producer,x.size,number.format(x.weight_grams),priceNumber.format(x.price_per_gram),priceNumber.format(x.price),labels.location(x.location_name),x.barcode].map((value,index)=><td key={index} className={`transfer-note__cell--${ADDED_PRODUCTS_COLUMNS[index]}`}>{display(value)}</td>)}</tr>)}</tbody></table></div>
  <section className="transfer-note__summary"><div><span>{labels.products}</span><strong>{document.product_count}</strong></div><div><span>{labels.totalWeight}</span><strong>{number.format(document.total_weight)} g</strong></div><div><span>{labels.totalValue}</span><strong>{money.format(document.total_value)}</strong></div></section>
  <p className="transfer-note__performed"><strong>{labels.createdBy}:</strong> {document.created_by_name}</p><section className="transfer-note__signatures"><div className="transfer-note__signature">{labels.signature}</div></section>
 </article></>;
}
