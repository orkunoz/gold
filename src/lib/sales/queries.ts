import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
