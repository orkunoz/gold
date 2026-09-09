import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getRecentSales(page = 1, pageSize = 25) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("sales")
    .select("id, sale_number, sold_at, total_sale_price, shops(name), employees(full_name), sale_items(count)", { count: "exact" })
    .order("sold_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error("Unable to load sales history.");
  return { sales: data ?? [], count: count ?? 0, page, pageSize };
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
