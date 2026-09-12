import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { createClient } from "@/lib/supabase/server";

export async function requireOwner() { const employee=await getCurrentEmployee(); if(employee.role!=="owner") redirect("/dashboard"); return employee; }
export const getAdminShopRecords = cache(async () => {
  await requireOwner(); const supabase=await createClient();
  const {data,error}=await supabase.from("shops").select("*").order("name");
  if(error) throw new Error("Unable to load shops.");
  return data??[];
});
export const getAdminShops = cache(async () => {
  await requireOwner(); const supabase=await createClient();
  const [shops,{data:employees,error:employeeError},{data:stock,error:stockError}] = await Promise.all([
    getAdminShopRecords(),
    supabase.from("employees").select("shop_id"),
    supabase.from("inventory_items").select("shop_id").eq("status","IN_STOCK"),
  ]);
  if(employeeError||stockError) throw new Error("Unable to load shops.");
  const stockCounts=new Map<string,number>(); for(const item of stock??[]) if(item.shop_id)stockCounts.set(item.shop_id,(stockCounts.get(item.shop_id)??0)+1);
  return (shops??[]).map(shop=>({...shop,employee_count:(employees??[]).filter(employee=>employee.shop_id===shop.id).length,in_stock_count:stockCounts.get(shop.id)??0}));
});

export const getAdminEmployees = cache(async () => {
  await requireOwner(); const supabase=await createClient();
  const {data,error}=await supabase.from("employees").select("id,email,username,full_name,role,shop_id,is_active,created_at,shops(name)").order("created_at");
  if(error) throw new Error("Unable to load accounts.");
  return data??[];
});

export async function getAdminData() {
  const [shops,employees]=await Promise.all([getAdminShopRecords(),getAdminEmployees()]);
  return {shops,employees};
}
