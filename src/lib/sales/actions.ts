"use server";

import { getTranslations } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/inventory/queries";

export type SaleConfirmation = { sale_id: string; sale_number: string; sold_at: string; total_sale_price: number; item_count: number };
export type CompleteSaleResult = { success: true; sale: SaleConfirmation } | { success: false; error: string };

function friendlySaleError(message: string | undefined, t: (key: string) => string) {
  if (!message) return t("sales.errors.notCompleted");
  if (message.includes("does not belong")) return t("sales.errors.otherShop");
  if (message.includes("IN_STOCK")) return t("sales.errors.unavailable");
  if (message.includes("cannot complete") || message.includes("active employee") || message.includes("Authentication")) return t("sales.errors.forbidden");
  if (message.includes("price") || message.includes("sale item")) return t("sales.errors.checkPrices");
  if (message.includes("do not exist")) return t("sales.errors.missing");
  return t("sales.errors.notCompleted");
}

export async function completeSaleAction(input: { shopId: string; items: Json }): Promise<CompleteSaleResult> {
  await getCurrentEmployee();
  const { t } = await getTranslations();
  if (!input.shopId || !Array.isArray(input.items) || input.items.length === 0) return { success: false, error: t("sales.errors.validItem") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", { p_shop_id: input.shopId, p_items: input.items, p_notes: undefined });
  const sale = data?.[0];
  if (error || !sale) return { success: false, error: friendlySaleError(error?.message,t) };
  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath(`/sales/${sale.sale_id}`);
  return { success: true, sale };
}
