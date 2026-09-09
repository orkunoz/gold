import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EffectivePrice } from "@/lib/pricing/model";

export type { EffectivePrice } from "@/lib/pricing/model";

export async function getEffectivePrice(client: SupabaseClient<Database>, inventoryItemId: string): Promise<EffectivePrice> {
  const { data, error } = await client.rpc("get_effective_inventory_price", { p_inventory_item_id: inventoryItemId }).single();
  if (error || !data) throw new Error("Unable to calculate the effective customer price.");
  return data;
}

export async function getEffectivePrices(client: SupabaseClient<Database>, inventoryItemIds: string[]) {
  if (!inventoryItemIds.length) return new Map<string, EffectivePrice>();
  const { data, error } = await client.rpc("get_effective_inventory_prices", { p_inventory_item_ids: inventoryItemIds });
  if (error) throw new Error("Unable to calculate effective customer prices.");
  return new Map((data ?? []).map(({ inventory_item_id, ...price }) => [inventory_item_id, price]));
}
