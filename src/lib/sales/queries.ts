import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export type SalesRegisterRow = {
  id:string; sale_number:string; sold_at:string; shop:string; employee:string;
  item_count:number; products:{category:string;count:number}[]; total_sale_price:number;
};
export type SoldProductRow={id:string;inventory_item_id:string;sale_id:string;sale_number:string;sold_at:string;shop_name:string;employee_name:string;category_name:string|null;producer:string|null;size:string|null;article_number:string|null;weight_grams:number|null;price_per_gram:number|null;metal:string|null;barcode:string|null;notes:string|null;list_price:number|null;discount_percent:number;sale_price:number};

export async function getSalesRegisterOptions(){
  const supabase=await createClient();
  const[{data:shops,error:shopError},{data:categories,error:categoryError},{data:employees,error:employeeError}]=await Promise.all([
    supabase.from("shops").select("id,name").order("name"),
    supabase.from("product_categories").select("id,name").eq("is_active",true).order("name"),
    supabase.from("employees").select("id,full_name").eq("is_active",true).order("full_name"),
  ]);
  if(shopError||categoryError||employeeError)throw new Error("Unable to load sales register filters.");
  return{shops:shops??[],categories:categories??[],employees:employees??[]};
}

export async function getSoldProductsRegister(filters:{shopId:string|null;category:string|null;producer:string|null;metal:string|null;employeeId:string|null;from:string|null;to:string|null;search:string|null;page:number},pageSize=50){
 const supabase=await createClient(); const {data,error}=await supabase.rpc("get_sold_products_register",{p_shop_id:filters.shopId,p_category:filters.category,p_producer:filters.producer,p_metal:filters.metal,p_employee_id:filters.employeeId,p_from:filters.from,p_to:filters.to,p_search:filters.search,p_page:filters.page,p_page_size:pageSize});
 if(error||!data)throw new Error("Unable to load sold products."); const result=data as Json as {products:SoldProductRow[];count:number;page:number;page_size:number}; return{products:result.products??[],count:Number(result.count??0),page:Number(result.page??1),pageSize:Number(result.page_size??pageSize)};
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
    supabase.from("sale_items").select("id, inventory_item_id, list_price, discount_percent, sale_price, barcode, article_number, category_name, producer, size, weight_grams, price_per_gram, metal, notes").eq("sale_id", id).order("created_at"),
  ]);
  if (saleError || itemError) throw new Error("Unable to load this sale.");
  if (!sale) notFound();
  return { sale, items: items ?? [] };
}
