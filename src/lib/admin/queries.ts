import "server-only";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { createClient } from "@/lib/supabase/server";

export async function requireOwner() { const employee=await getCurrentEmployee(); if(employee.role!=="owner") redirect("/dashboard"); return employee; }
export async function getAdminData() {
  await requireOwner(); const supabase=await createClient();
  const [{data:shops,error:shopError},{data:employees,error:employeeError},{data:stock,error:stockError}] = await Promise.all([
    supabase.from("shops").select("*").order("name"),
    supabase.from("employees").select("id,email,username,full_name,role,shop_id,is_active,created_at,shops(name)").order("created_at"),
    supabase.from("inventory_items").select("shop_id").eq("status","IN_STOCK"),
  ]);
  if(shopError||employeeError||stockError) throw new Error("Unable to load administration data.");
  const stockCounts=new Map<string,number>(); for(const item of stock??[]) stockCounts.set(item.shop_id,(stockCounts.get(item.shop_id)??0)+1);
  return {shops:(shops??[]).map(shop=>({...shop,employee_count:(employees??[]).filter(employee=>employee.shop_id===shop.id).length,in_stock_count:stockCounts.get(shop.id)??0})),employees:employees??[]};
}
