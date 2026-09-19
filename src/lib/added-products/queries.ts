import {notFound} from "next/navigation";
import {getCurrentEmployee} from "@/lib/inventory/queries";
import {createClient} from "@/lib/supabase/server";

async function owner(){if((await getCurrentEmployee()).role!=="owner")notFound()}
const HEADER_FIELDS="id,document_number,created_at,created_by_name,location_names,product_count,total_weight,total_value";
const ITEM_FIELDS="id,line_number,category_name,article_number,producer,size,weight_grams,price_per_gram,price,location_name,barcode";
export async function getAddedProductDocuments(){await owner();const db=await createClient();const{data,error}=await db.from("added_product_documents").select(HEADER_FIELDS).order("created_at",{ascending:false});if(error)throw new Error("Unable to load added product documents.");return data??[]}
export async function getAddedProductDocument(id:string){await owner();const db=await createClient();const[{data:document,error},{data:items,error:itemError}]=await Promise.all([db.from("added_product_documents").select(HEADER_FIELDS).eq("id",id).maybeSingle(),db.from("added_product_document_items").select(ITEM_FIELDS).eq("document_id",id).order("line_number")]);if(error||itemError||!document)notFound();return{document,items:items??[]}}
