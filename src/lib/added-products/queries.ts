import {notFound} from "next/navigation";
import {getCurrentEmployee} from "@/lib/inventory/queries";
import {createClient} from "@/lib/supabase/server";

async function owner(){if((await getCurrentEmployee()).role!=="owner")notFound()}
export async function getAddedProductDocuments(){await owner();const db=await createClient();const{data,error}=await db.from("added_product_documents").select("*").order("created_at",{ascending:false});if(error)throw new Error("Unable to load added product documents.");return data??[]}
export async function getAddedProductDocument(id:string){await owner();const db=await createClient();const[{data:document,error},{data:items,error:itemError}]=await Promise.all([db.from("added_product_documents").select("*").eq("id",id).maybeSingle(),db.from("added_product_document_items").select("*").eq("document_id",id).order("line_number")]);if(error||itemError||!document)notFound();return{document,items:items??[]}}
