"use client";
import Link from "next/link";
import {useActionState,useState} from "react";
import type {InventoryStatus,Tables} from "@/lib/database.types";
import type {InventoryActionState} from "@/lib/inventory/actions";
import {INVENTORY_STATUSES,STATUS_LABELS} from "@/lib/inventory/constants";
import {formatPrice} from "@/lib/inventory/format";
type Action=(state:InventoryActionState,formData:FormData)=>Promise<InventoryActionState>;
type Props={action:Action;categories:Pick<Tables<"product_categories">,"id"|"name">[];shops:Pick<Tables<"shops">,"id"|"name"|"code">[];item?:Tables<"inventory_items">;categoryName?:string|null;cancelHref:string};
const input="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-amber-700";
const label="block text-sm font-medium text-stone-800";
const ErrorText=({text}:{text?:string})=>text?<p className="mt-1 text-sm text-red-700">{text}</p>:null;
export function InventoryForm({action,categories,shops,item,categoryName,cancelHref}:Props){
 const[state,formAction,pending]=useActionState(action,{error:""});const[weight,setWeight]=useState(String(item?.weight_grams??""));const[rate,setRate]=useState(String(item?.price_per_gram??""));const calculated=weight!==""&&rate!==""&&Number.isFinite(Number(weight))&&Number.isFinite(Number(rate))?Number(weight)*Number(rate):null;
 return <form action={formAction} className="space-y-8" aria-busy={pending}>{state.error?<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</div>:null}<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
  <label className={label}>Product Category<input name="category_name" list="inventory-category-options" defaultValue={categoryName??""} className={input}/><datalist id="inventory-category-options">{categories.map(c=><option key={c.id} value={c.name}/>)}</datalist></label>
  <label className={label}>Producer<input name="producer" defaultValue={item?.producer??""} className={input}/></label>
  <label className={label}>Metal<select name="metal" defaultValue={item?.metal??""} className={input}><option value="">Not specified</option><option value="Gold">Gold</option><option value="Silver">Silver</option></select><ErrorText text={state.fieldErrors?.metal}/></label>
  <label className={label}>Fineness<input name="gold_fineness" inputMode="numeric" defaultValue={item?.gold_fineness??""} className={input}/></label>
  <label className={label}>Size<input name="size" defaultValue={item?.size??""} className={input}/></label>
  <label className={label}>Weight<input name="weight_grams" type="number" min="0" step="0.001" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} className={input}/><ErrorText text={state.fieldErrors?.weight_grams}/></label>
  <label className={label}>Price per Gram<input name="price_per_gram" type="number" min="0" step="0.01" inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value)} className={input}/><ErrorText text={state.fieldErrors?.price_per_gram}/></label>
  <label className={label}>Article<input name="article_number" defaultValue={item?.article_number??""} className={input}/></label>
  <div className={label}>Price (UAH)<p className={`${input} bg-stone-100`}>{formatPrice(calculated)}</p></div>
  <label className={`${label} sm:col-span-2`}>Notes<textarea name="notes" rows={3} defaultValue={item?.notes??""} className={input}/></label>
  <label className={label}>Status<select name="status" required defaultValue={(item?.status??"IN_STOCK") as InventoryStatus} className={input}>{INVENTORY_STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select><ErrorText text={state.fieldErrors?.status}/></label>
  <label className={label}>Shop<select name="shop_id" defaultValue={item?.shop_id??(shops.length===1?shops[0].id:"")} className={input}><option value="">Unassigned</option>{shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ErrorText text={state.fieldErrors?.shop_id}/></label>
  <label className={label}>Barcode<input name="barcode" maxLength={200} defaultValue={item?.barcode??""} className={input}/><ErrorText text={state.fieldErrors?.barcode}/></label>
  <input type="hidden" name="owner_price" value={item?.owner_price??""}/><input type="hidden" name="selling_price" value={item?.selling_price??""}/><input type="hidden" name="discount" value={item?.discount??""}/><input type="hidden" name="received_at" value={item?.received_at?.slice(0,10)??""}/><input type="hidden" name="gold_color" value={item?.gold_color??""}/>
 </div><div className="flex flex-col gap-3 border-t border-stone-200 pt-6 sm:flex-row"><button disabled={pending} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{pending?"Saving…":item?"Save changes":"Add product"}</button><Link href={cancelHref} className="px-5 py-2.5 text-center text-sm">Cancel</Link></div></form>;
}
