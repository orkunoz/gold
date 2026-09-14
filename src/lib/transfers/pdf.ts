import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 36;
const fontPath = join(process.cwd(), "public", "fonts", "geist-regular.ttf");
let glyphs = new Map<number, number>();
let glyphWidths: number[] = [];

type Transfer = { transfer_number:string; transferred_at:string; source_name:string; destination_name:string; source_address:string|null; destination_address:string|null; performed_by_name:string; total_weight:number; total_value:number };
type TransferItem = { line_number:number; category_name:string|null; article_number:string|null; producer:string|null; size:string|null; weight_grams:number|null; purchase_price:number|null; price_per_gram:number|null; price:number|null; barcode:string|null };
type Align = "left" | "center" | "right";

function readCmap(font: Buffer) {
  const tables = font.readUInt16BE(4); let offset = 0;
  for (let index=0; index<tables; index++) { const pointer=12+index*16; if(font.toString("ascii",pointer,pointer+4)==="cmap"){offset=font.readUInt32BE(pointer+8);break;} }
  const count=font.readUInt16BE(offset+2); let subtable=0;
  for(let index=0;index<count;index++){const pointer=offset+4+index*8,platform=font.readUInt16BE(pointer);if(platform===3){const candidate=offset+font.readUInt32BE(pointer+4);if(font.readUInt16BE(candidate)===4){subtable=candidate;break;}}}
  const segmentCount=font.readUInt16BE(subtable+6)/2,end=subtable+14,start=end+segmentCount*2+2,delta=start+segmentCount*2,range=delta+segmentCount*2,map=new Map<number,number>();
  for(let segment=0;segment<segmentCount;segment++){const first=font.readUInt16BE(start+segment*2),last=font.readUInt16BE(end+segment*2),change=font.readInt16BE(delta+segment*2),rangeOffset=font.readUInt16BE(range+segment*2);for(let code=first;code<=last&&code!==65535;code++){let glyph=rangeOffset?font.readUInt16BE(range+segment*2+rangeOffset+2*(code-first)):0;glyph=glyph?(glyph+change)&65535:(code+change)&65535;map.set(code,glyph);}}
  return map;
}

function loadFont() {
  const font=readFileSync(fontPath),tables=new Map<string,number>(),count=font.readUInt16BE(4);
  for(let index=0;index<count;index++){const pointer=12+index*16;tables.set(font.toString("ascii",pointer,pointer+4),font.readUInt32BE(pointer+8));}
  glyphs=readCmap(font); const units=font.readUInt16BE((tables.get("head")??0)+18),metrics=font.readUInt16BE((tables.get("hhea")??0)+34),glyphCount=font.readUInt16BE((tables.get("maxp")??0)+4),hmtx=tables.get("hmtx")??0;glyphWidths=[];let last=0;
  for(let index=0;index<glyphCount;index++){if(index<metrics)last=font.readUInt16BE(hmtx+index*4);glyphWidths.push(Math.round(last*1000/units));}
  return font;
}

const clean=(value:unknown)=>String(value??"—").replace(/[\r\n]+/g," ").trim()||"—";
const hex=(value:string)=>Array.from(value).map(character=>(glyphs.get(character.codePointAt(0)!)??0).toString(16).padStart(4,"0")).join("").toUpperCase();
const number=(value:number|null)=>value===null?"—":new Intl.NumberFormat("uk-UA",{maximumFractionDigits:2}).format(value);
const money=(value:number|null)=>value===null?"—":new Intl.NumberFormat("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
function textWidth(value:string,size:number){return Array.from(value).reduce((sum,character)=>sum+(glyphWidths[glyphs.get(character.codePointAt(0)!)??0]??600),0)*size/1000;}
function fit(value:string,width:number,size:number){const input=clean(value);if(textWidth(input,size)<=width)return input;let output=input;while(output.length&&textWidth(`${output}…`,size)>width)output=output.slice(0,-1);return `${output}…`;}
function text(value:string,x:number,y:number,size=9,align:Align="left",width=0,color="0.12 0.10 0.08") { const fitted=width?fit(value,width,size):value, measured=textWidth(fitted,size),position=align==="right"?x+width-measured:align==="center"?x+(width-measured)/2:x;return `${color} rg BT /F1 ${size} Tf ${position.toFixed(2)} ${y.toFixed(2)} Td <${hex(fitted)}> Tj ET`; }
const line=(x1:number,y1:number,x2:number,y2:number,width=.5,color="0.65 0.62 0.57")=>`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
const rect=(x:number,y:number,width:number,height:number,fill?:string)=>fill?`${fill} rg ${x} ${y} ${width} ${height} re f`:`0.65 0.62 0.57 RG .5 w ${x} ${y} ${width} ${height} re S`;

const columns=[
  {label:"№",width:20,align:"right" as Align},{label:"Виріб",width:80,align:"left" as Align},{label:"Артикул",width:52,align:"left" as Align},{label:"Виробник",width:70,align:"left" as Align},{label:"Розмір",width:32,align:"center" as Align},{label:"Вага",width:38,align:"right" as Align},{label:"Ціна закупки",width:55,align:"right" as Align},{label:"Ціна за грам",width:52,align:"right" as Align},{label:"Ціна (грн)",width:54,align:"right" as Align},{label:"Штрихкод",width:70,align:"left" as Align},
];
const tableWidth=columns.reduce((sum,column)=>sum+column.width,0),rowHeight=23,headerHeight=27;

function pageHeader(commands:string[],transfer:Transfer,continued=false){
  commands.push(text("ZLATA",MARGIN,795,15,"left",90,"0.40 0.27 0.08"));commands.push(text("JEWELRY",MARGIN,782,6.5,"left",90,"0.35 0.33 0.30"));
  commands.push(text(continued?"Накладна переміщення - продовження":"Накладна переміщення",135,793,17,"center",325));
  commands.push(text(transfer.transfer_number,430,797,8,"right",129));commands.push(text(new Intl.DateTimeFormat("uk-UA",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Kyiv"}).format(new Date(transfer.transferred_at)),430,783,7,"right",129,"0.35 0.33 0.30"));commands.push(line(MARGIN,767,PAGE_WIDTH-MARGIN,767,1,"0.40 0.27 0.08"));
}

function infoBlock(commands:string[],transfer:Transfer){
  const top=740,height=76,half=(tableWidth-12)/2;commands.push(rect(MARGIN,top-height,half,height,"0.97 0.96 0.93"),rect(MARGIN+half+12,top-height,half,height,"0.97 0.96 0.93"));
  commands.push(text("Звідки / From",MARGIN+12,top-19,8.5,"left",half-24,"0.40 0.27 0.08"),text(clean(transfer.source_name),MARGIN+12,top-39,11,"left",half-24),text(clean(transfer.source_address),MARGIN+12,top-56,7.5,"left",half-24,"0.35 0.33 0.30"));
  commands.push(text("Куди / To",MARGIN+half+24,top-19,8.5,"left",half-24,"0.40 0.27 0.08"),text(clean(transfer.destination_name),MARGIN+half+24,top-39,11,"left",half-24),text(clean(transfer.destination_address),MARGIN+half+24,top-56,7.5,"left",half-24,"0.35 0.33 0.30"));
}

function tableHeader(commands:string[],top:number){let x=MARGIN;commands.push(rect(MARGIN,top-headerHeight,tableWidth,headerHeight,"0.91 0.89 0.84"));for(const column of columns){commands.push(rect(x,top-headerHeight,column.width,headerHeight),text(column.label,x+3,top-17,6.2,column.align,column.width-6));x+=column.width;}return top-headerHeight;}
function tableRow(commands:string[],top:number,item:TransferItem){const values=[String(item.line_number),clean(item.category_name),clean(item.article_number),clean(item.producer),clean(item.size),number(item.weight_grams),money(item.purchase_price),money(item.price_per_gram),money(item.price),clean(item.barcode)];let x=MARGIN;for(let index=0;index<columns.length;index++){const column=columns[index];commands.push(rect(x,top-rowHeight,column.width,rowHeight),text(values[index],x+3,top-15,6.4,column.align,column.width-6));x+=column.width;}return top-rowHeight;}

function totals(commands:string[],transfer:Transfer,itemCount:number,y:number){commands.push(line(MARGIN,y,PAGE_WIDTH-MARGIN,y,1,"0.40 0.27 0.08"));const cards=[[`Кількість`,String(itemCount)],["Загальна вага",`${number(transfer.total_weight)} г`],["Загальна вартість",`${money(transfer.total_value)} грн`]];cards.forEach(([label,value],index)=>{const x=MARGIN+index*174;commands.push(text(label,x,y-20,7.5,"left",160,"0.35 0.33 0.30"),text(value,x,y-39,11,"left",160));});commands.push(text(`Створив / Виконав: ${clean(transfer.performed_by_name)}`,MARGIN,y-64,8.5,"left",tableWidth));commands.push(text("Передав  ______________________________",MARGIN,y-98,8.5,"left",245),text("Прийняв  ______________________________",314,y-98,8.5,"left",245));}

export function transferPdf(transfer:Transfer,items:TransferItem[]){
  const font=loadFont(),pages:string[][]=[];let commands:string[]=[],y=0,index=0;
  const newPage=(continued=false)=>{commands=[];pages.push(commands);pageHeader(commands,transfer,continued);if(!continued){infoBlock(commands,transfer);y=642;}else y=746;y=tableHeader(commands,y);};newPage();
  while(index<items.length){if(y-rowHeight<72){newPage(true);}y=tableRow(commands,y,items[index]);index++;}
  if(y<155)newPage(true);totals(commands,transfer,items.length,y-18);
  return buildPdf(font,pages);
}

function buildPdf(font:Buffer,pages:string[][]){
  const pageStart=7,kids=pages.map((_,index)=>`${pageStart+index*2} 0 R`).join(" "),objects:Buffer[]=[Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`),Buffer.from("<< /Type /Font /Subtype /Type0 /BaseFont /Geist /Encoding /Identity-H /DescendantFonts [4 0 R] >>"),Buffer.from(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Geist /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /DW 1000 /W [0 [${glyphWidths.join(" ")}]] >>`),Buffer.from("<< /Type /FontDescriptor /FontName /Geist /Flags 32 /FontBBox [-600 -300 1400 1100] /ItalicAngle 0 /Ascent 1000 /Descent -250 /CapHeight 700 /StemV 80 /FontFile2 6 0 R >>"),Buffer.concat([Buffer.from(`<< /Length ${font.length} /Length1 ${font.length} >>\nstream\n`),font,Buffer.from("\nendstream")])];
  pages.forEach((page,index)=>{const content=Buffer.from(page.join("\n")),pageId=pageStart+index*2,streamId=pageId+1;objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`),Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`),content,Buffer.from("\nendstream") ]));});
  const chunks=[Buffer.from("%PDF-1.7\n")],offsets=[0];let offset=chunks[0].length;objects.forEach((object,index)=>{offsets.push(offset);const chunk=Buffer.concat([Buffer.from(`${index+1} 0 obj\n`),object,Buffer.from("\nendobj\n")]);chunks.push(chunk);offset+=chunk.length;});let table=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let index=1;index<offsets.length;index++)table+=`${String(offsets[index]).padStart(10,"0")} 00000 n \n`;chunks.push(Buffer.from(`${table}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`));return Buffer.concat(chunks);
}

export function transferPdfFilename(transferNumber:string){const sequence=transferNumber.match(/(\d{6})$/)?.[1];return sequence?`transfer-${sequence}.pdf`:`transfer-${transferNumber.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}.pdf`;}
