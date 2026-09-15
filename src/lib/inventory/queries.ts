import "server-only";
import { cache } from "react";

import { notFound, redirect } from "next/navigation";
import type { EmployeeRole, InventoryStatus, Tables } from "@/lib/database.types";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { applyExactBarcodeMatch } from "@/lib/inventory/scanner";
import { readWithRetry } from "@/lib/supabase/read";
import { kyivCalendarDateBoundaries } from "@/lib/inventory/created-date";

export type CurrentEmployee = Pick<
  Tables<"employees">,
  "id" | "username" | "full_name" | "role" | "shop_id" | "is_active"
>;

export type InventoryFilters = {
  barcode?: string;
  article?: string;
  category?: string;
  status?: InventoryStatus | "ALL";
  shop?: string;
  createdDate?: string;
};

export const INVENTORY_SORTS = ["number", "productCategory", "article", "producer", "size", "weight", "purchasePrice", "pricePerGram", "priceUah", "shop", "createdDate"] as const;
export type InventorySort = typeof INVENTORY_SORTS[number];
export type SortDirection = "asc" | "desc";

export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee> => {
  const claims = await requireUser();
  const supabase = await createClient();
  const { data, error } = await readWithRetry("current_employee", () => supabase
    .from("employees")
    .select("id, username, full_name, role, shop_id, is_active")
    .eq("auth_user_id", String(claims.sub))
    .maybeSingle());

  if (error) throw new Error("Unable to verify the current account.");
  if (!data?.is_active) redirect("/login");
  return data;
});
export const getShopName = cache(async (shopId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await readWithRetry("current_employee_shop", () => supabase.from("shops").select("name").eq("id", shopId).maybeSingle());
  if (error) throw new Error("Unable to load the assigned shop.");
  return data?.name ?? null;
});
export const getActiveShops = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await readWithRetry("active_shops", () => supabase.from("shops").select("id, name, code, location_type").eq("is_active", true).eq("location_type", "SHOP").order("name"));
  if (error) throw new Error("Unable to load shops.");
  return data ?? [];
});
export const getActiveLocations = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await readWithRetry("active_locations", () => supabase.from("shops").select("id, name, code, location_type").eq("is_active", true).order("name"));
  if (error) throw new Error("Unable to load locations.");
  return data ?? [];
});
export const getInventoryOptions = cache(async (includeLocations = true) => {
  const supabase = await createClient();
  const [categoryResult, locationResult] = await Promise.all([
    readWithRetry("inventory_category_options", () => supabase.rpc("get_inventory_category_options")),
    includeLocations ? getActiveLocations().then(data => ({ data, error: null })).catch(() => ({ data: [], error: true })) : Promise.resolve({ data: [], error: null }),
  ]);
  if (categoryResult.error) console.error("inventory_options_fallback", { option: "categories" });
  if (locationResult.error) console.error("inventory_options_fallback", { option: "locations" });
  return { categories: (categoryResult.data ?? []).map(({ id, name }) => ({ id, name })), shops: locationResult.data };
});

function safeSearch(value: string | undefined) {
  return value?.trim().slice(0, 100).replace(/[,%()]/g, "") ?? "";
}

const inventorySortColumns: Record<InventorySort, string> = {
  number: "created_at",
  productCategory: "product_categories(name)",
  article: "article_number",
  producer: "producer",
  size: "size",
  weight: "weight_grams",
  purchasePrice: "purchase_price",
  pricePerGram: "price_per_gram",
  priceUah: "price",
  shop: "shops(name)",
  createdDate: "created_at",
};

export async function getInventoryItems(filters: InventoryFilters, page = 1, pageSize = 50, sort: InventorySort = "number", direction: SortDirection = "asc") {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("inventory_items")
    .select("*, product_categories(name), shops(name, code, location_type)", { count: "exact" })
    .order(inventorySortColumns[sort], { ascending: direction === "asc", nullsFirst: false })
    .order("id", { ascending: direction === "asc" })
    .range(from, from + pageSize - 1);

  const barcode = safeSearch(filters.barcode);
  const article = safeSearch(filters.article);
  if (barcode) query = query.ilike("barcode", `%${barcode}%`);
  if (article) query = query.ilike("article_number", `%${article}%`);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
  if (filters.shop) query = query.eq("shop_id", filters.shop);
  if (filters.createdDate) {
    const boundaries = kyivCalendarDateBoundaries(filters.createdDate);
    if (boundaries) query = query.gte("created_at", boundaries.start).lt("created_at", boundaries.end);
  }

  const { data, error, count } = await readWithRetry("inventory_items", () => query);
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
    .select("*, product_categories(name), shops(name, code, location_type), employees(full_name)")
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
