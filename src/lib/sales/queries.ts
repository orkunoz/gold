import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReportingPeriod } from "@/lib/dashboard/model";
import { reportingBoundaries } from "@/lib/dashboard/model";

export async function getSaleDetail(id: string) {
  const supabase = await createClient();
  const [{ data: sale, error: saleError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("sales").select("id, sale_number, sold_at, total_list_price, total_sale_price, notes, shop_name, employee_name, employee_username, shops(name), employees(full_name)").eq("id", id).maybeSingle(),
    supabase.from("sale_items").select("id, inventory_item_id, list_price, discount_percent, sale_price, barcode, article_number, category_name, producer, size, weight_grams, price_per_gram, notes").eq("sale_id", id).order("created_at"),
  ]);
  if (saleError || itemError) throw new Error("Unable to load this sale.");
  if (!sale) notFound();
  return { sale, items: items ?? [] };
}

export async function getSalesHistory({ period, start, end, shopId, page = 1, pageSize = 25 }: { period: ReportingPeriod; start?: string; end?: string; shopId: string | null; page?: number; pageSize?: number }) {
  const supabase = await createClient();
  const boundaries = reportingBoundaries(period, start, end);
  if (!boundaries) throw new Error("Select a valid sales history range.");
  const from = (page - 1) * pageSize;
  let query = supabase.from("sales").select("id,sale_number,sold_at,total_sale_price,shop_id,employee_id,shop_name,employee_name,employee_username,shops(name,location_type),employees(full_name,username)", { count: "exact" }).order("sold_at", { ascending: false }).range(from, from + pageSize - 1);
  if (boundaries.start) query = query.gte("sold_at", boundaries.start);
  if (boundaries.end) query = query.lt("sold_at", boundaries.end);
  if (shopId) query = query.eq("shop_id", shopId);
  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load sales history.");
  const sales = data ?? [];
  const ids = sales.map(sale => sale.id);
  const itemResult = ids.length ? await supabase.from("sale_items").select("sale_id,weight_grams").in("sale_id", ids) : { data: [], error: null };
  if (itemResult.error) throw new Error("Unable to load sales history totals.");
  const totals = new Map<string, { items: number; weight: number }>();
  for (const item of itemResult.data ?? []) { const current = totals.get(item.sale_id) ?? { items: 0, weight: 0 }; current.items += 1; current.weight += Number(item.weight_grams ?? 0); totals.set(item.sale_id, current); }
  return { sales: sales.map(sale => ({ ...sale, items: totals.get(sale.id)?.items ?? 0, weight: totals.get(sale.id)?.weight ?? 0 })), count: count ?? 0, page, pageSize };
}
