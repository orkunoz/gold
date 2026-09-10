import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export type SalesRegisterRow = {
  id:string; sale_number:string; sold_at:string; shop:string; employee:string;
  item_count:number; products:{category:string;count:number}[]; total_sale_price:number;
};

export async function getSalesRegisterOptions(){
  const supabase=await createClient();
  const[{data:shops,error:shopError},{data:categories,error:categoryError}]=await Promise.all([
    supabase.from("shops").select("id,name").order("name"),
    supabase.from("product_categories").select("id,name").eq("is_active",true).order("name"),
  ]);
  if(shopError||categoryError)throw new Error("Unable to load sales register filters.");
  return{shops:shops??[],categories:categories??[]};
}

export async function getSalesRegister(filters:{shopId:string|null;category:string|null;page:number},pageSize=25) {
  const supabase = await createClient();
  const {data,error}=await supabase.rpc("get_sales_register",{p_shop_id:filters.shopId,p_category_filter:filters.category,p_page:filters.page,p_page_size:pageSize});
  if(error||!data)throw new Error("Unable to load sales register.");
  const result=data as Json as {sales:SalesRegisterRow[];count:number;page:number;page_size:number};
  return {sales:result.sales??[],count:Number(result.count??0),page:Number(result.page??filters.page),pageSize:Number(result.page_size??pageSize)};
}

export async function getSaleDetail(id: string) {
  const supabase = await createClient();
  const [{ data: sale, error: saleError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("sales").select("id, sale_number, sold_at, total_list_price, total_sale_price, notes, shops(name), employees(full_name)").eq("id", id).maybeSingle(),
    supabase.from("sale_items").select("id, list_price, sale_price, inventory_items(barcode, article_number, weight_grams, product_categories(name))").eq("sale_id", id).order("created_at"),
  ]);
  if (saleError || itemError) throw new Error("Unable to load this sale.");
  if (!sale) notFound();
  return { sale, items: items ?? [] };
}
