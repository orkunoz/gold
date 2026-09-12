import "server-only";
import { cache } from "react";

import { notFound, redirect } from "next/navigation";
import type { EmployeeRole, InventoryStatus, Tables } from "@/lib/database.types";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { applyExactBarcodeMatch } from "@/lib/inventory/scanner";

export type CurrentEmployee = Pick<
  Tables<"employees">,
  "id" | "username" | "full_name" | "role" | "shop_id" | "is_active"
> & { shops: { name: string } | null };

export type InventoryFilters = {
  barcode?: string;
  article?: string;
  category?: string;
  metal?: "Gold" | "Silver";
  status?: InventoryStatus;
  shop?: string;
  search?: string;
};

export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee> => {
  const claims = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, username, full_name, role, shop_id, is_active, shops(name)")
    .eq("auth_user_id", String(claims.sub))
    .single();

  if (error || !data?.is_active) redirect("/login");
  return data;
});
export const getActiveShops = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shops").select("id, name, code").eq("is_active", true).order("name");
  if (error) throw new Error("Unable to load shops.");
  return data ?? [];
});
export const getInventoryOptions = cache(async () => {
  const supabase = await createClient();
  const [{ data: categories, error: categoryError }, shops] = await Promise.all([supabase.rpc("get_inventory_category_options"), getActiveShops()]);

  if (categoryError) throw new Error("Unable to load inventory options.");
  return { categories: (categories ?? []).map(({ id, name }) => ({ id, name })), shops: shops ?? [] };
});

function safeSearch(value: string | undefined) {
  return value?.trim().slice(0, 100).replace(/[,%()]/g, "") ?? "";
}

export async function getInventoryItems(filters: InventoryFilters, page = 1, pageSize = 50) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("inventory_items")
    .select("*, product_categories(name), shops(name, code)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const barcode = safeSearch(filters.barcode);
  const article = safeSearch(filters.article);
  const search = safeSearch(filters.search);
  if (barcode) query = query.ilike("barcode", `%${barcode}%`);
  if (article) query = query.ilike("article_number", `%${article}%`);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.metal) query = query.eq("metal", filters.metal);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.shop) query = query.eq("shop_id", filters.shop);
  if (search) query = query.or(`barcode.ilike.%${search}%,article_number.ilike.%${search}%,producer.ilike.%${search}%,notes.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load inventory.");
  return { items: data ?? [], count: count ?? 0, page, pageSize };
}

export async function findInventoryItemByBarcode(barcode: string) {
  const supabase = await createClient();
  const query = supabase
    .from("inventory_items")
    .select("id");
  const { data, error } = await applyExactBarcodeMatch(query, barcode).maybeSingle();
  if (error) throw new Error("Unable to search inventory.");
  return data;
}

export async function getInventoryItem(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, product_categories(name), shops(name, code), employees(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load this inventory item.");
  if (!data) notFound();
  return data;
}

export async function getInventoryHistory(id:string){
  const supabase=await createClient();
  const {data,error}=await supabase.from("inventory_item_history").select("id,field_name,old_value,new_value,source,changed_at,sale_id,changed_by_name,changed_by_username,employees:changed_by_employee_id(full_name),sales:sale_id(sale_number)").eq("inventory_item_id",id).order("changed_at",{ascending:false});
  if(error)throw new Error("Unable to load product history.");
  return data??[];
}

export function canManageInventory(role: EmployeeRole) {
  return role === "owner";
}
