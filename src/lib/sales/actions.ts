"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/inventory/queries";

export type SaleConfirmation = { sale_id: string; sale_number: string; sold_at: string; total_sale_price: number; item_count: number };
export type CompleteSaleResult = { success: true; sale: SaleConfirmation } | { success: false; error: string };

function friendlySaleError(message: string | undefined) {
  if (!message) return "Sale could not be completed. No items were sold.";
  if (message.includes("does not belong")) return "One or more items belong to another shop. No items were sold.";
  if (message.includes("IN_STOCK")) return "One or more items can no longer be sold. Refresh the sale and check the items. No items were sold.";
  if (message.includes("cannot complete") || message.includes("active employee") || message.includes("Authentication")) return "You are not allowed to complete this sale. No items were sold.";
  if (message.includes("price") || message.includes("sale item")) return "Check the sale prices and items. No items were sold.";
  if (message.includes("do not exist")) return "One of the items is no longer available. Refresh the sale and check the items. No items were sold.";
  return "Sale could not be completed. No items were sold.";
}

export async function completeSaleAction(input: { shopId: string; items: Json; notes: string | null }): Promise<CompleteSaleResult> {
  await getCurrentEmployee();
  if (!input.shopId || !Array.isArray(input.items) || input.items.length === 0) return { success: false, error: "Add at least one valid item before completing the sale." };
  if (input.notes && input.notes.length > 5000) return { success: false, error: "Sale notes cannot exceed 5000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", { p_shop_id: input.shopId, p_items: input.items, p_notes: input.notes ?? undefined });
  const sale = data?.[0];
  if (error || !sale) return { success: false, error: friendlySaleError(error?.message) };
  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath(`/sales/${sale.sale_id}`);
  return { success: true, sale };
}
