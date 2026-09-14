import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { createClient } from "@/lib/supabase/server";
import { readWithRetry } from "@/lib/supabase/read";

export async function requireOwner() { const employee=await getCurrentEmployee(); if(employee.role!=="owner") redirect("/dashboard"); return employee; }
export const getAdminShopRecords = cache(async () => {
  await requireOwner(); const supabase=await createClient();
  const {data,error}=await readWithRetry("admin_shop_records",()=>supabase.from("shops").select("*").order("name"));
  if(error) throw new Error("Unable to load shops.");
  return data??[];
});
export const getAdminShops = cache(async () => {
  await requireOwner(); const supabase=await createClient();
  const [shops,{data:counts,error:countError}] = await Promise.all([
    getAdminShopRecords(),
    readWithRetry("admin_shop_counts",()=>supabase.rpc("get_admin_shop_counts")),
  ]);
  if(countError) throw new Error("Unable to load shop counts.");
  const byShop=new Map((counts??[]).map(row=>[row.shop_id,row]));
  return (shops??[]).map(shop=>({...shop,employee_count:Number(byShop.get(shop.id)?.employee_count??0),in_stock_count:Number(byShop.get(shop.id)?.in_stock_count??0)}));
});

export const getAdminEmployees = cache(async () => {
  await requireOwner(); const supabase=await createClient();
  const {data,error}=await readWithRetry("admin_employees",()=>supabase.from("employees").select("id,email,username,full_name,role,shop_id,is_active,created_at,shops(name,location_type)").order("created_at"));
  if(error) throw new Error("Unable to load accounts.");
  return data??[];
});

export async function getAdminData() {
  const [shops,employees]=await Promise.all([getAdminShopRecords(),getAdminEmployees()]);
  return {shops,employees};
}
