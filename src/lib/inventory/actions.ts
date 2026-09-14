"use server";

import { getTranslations } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInventory, getCurrentEmployee } from "./queries";
import { inventoryMutationTimer } from "./mutation-timing";
import { toInventoryUpdate, validateInventoryForm, type InventoryFormErrors } from "./validation";

export type InventoryActionState = { error: string; fieldErrors?: InventoryFormErrors };
export type BulkMoveState = { error: string; success?: string; transferId?: string };

function databaseError(error: { code?: string; message?: string } | null): InventoryActionState {
  if (error?.code === "23505") return { error: "An item with this barcode already exists.", fieldErrors: { barcode: "Barcode must be unique." } };
  if (error?.code === "42501") return { error: "You do not have permission to make this change." };
  if (error?.code === "22023" && error.message?.includes("SOLD products")) return { error: "SOLD products are read-only and cannot be edited." };
  return { error: "Unable to save this item. Please try again." };
}

async function resolveCategory(client: Awaited<ReturnType<typeof createClient>>, name: string | null) {
  if (!name) return null;
  const { data, error } = await client.rpc("resolve_product_category", { p_name: name });
  if (error || !data) throw new Error("Unable to resolve product category.");
  return data;
}

export async function createInventoryItem(_previous: InventoryActionState, formData: FormData): Promise<InventoryActionState> {
  const timing = inventoryMutationTimer("create");
  const employee = await timing.phase("authorization", getCurrentEmployee);
  if (!canManageInventory(employee.role)) { timing.finish(); return { error: "You do not have permission to add inventory." }; }
  formData.set("status", "IN_STOCK");
  const validation = validateInventoryForm(formData);
  if (!validation.success) { timing.finish(); return { error: "Check the highlighted fields.", fieldErrors: validation.errors }; }
  const supabase = await createClient();
  let categoryId: string | null;
  try { categoryId = await timing.phase("category_rpc", () => resolveCategory(supabase, validation.data.category_name)); }
  catch { timing.finish(); return { error: "Unable to create or select this category." }; }
  const { category_name: categoryName, ...inventory } = validation.data;
  void categoryName;
  const { data, error } = await timing.phase("database_write_and_audit", () => supabase.from("inventory_items").insert({ ...inventory, category_id: categoryId, created_by: employee.id }).select("id").single());
  if (error || !data) { timing.finish(); return databaseError(error); }
  timing.mark("revalidation_skipped_redirect_reads_fresh_data");
  timing.finish();
  redirect(`/inventory/${data.id}`);
}

export async function updateInventoryItem(id: string, _previous: InventoryActionState, formData: FormData): Promise<InventoryActionState> {
  const timing = inventoryMutationTimer("update");
  const employee = await timing.phase("authorization", getCurrentEmployee);
  if (!canManageInventory(employee.role)) { timing.finish(); return { error: "You do not have permission to edit inventory." }; }
  const validation = validateInventoryForm(formData);
  if (!validation.success) { timing.finish(); return { error: "Check the highlighted fields.", fieldErrors: validation.errors }; }
  const supabase = await createClient();
  let categoryId: string | null;
  try { categoryId = await timing.phase("category_rpc", () => resolveCategory(supabase, validation.data.category_name)); }
  catch { timing.finish(); return { error: "Unable to create or select this category." }; }
  const { category_name: categoryName, ...inventory } = validation.data;
  void categoryName;
  const { data, error } = await timing.phase("database_write_and_audit", () => supabase.from("inventory_items").update(toInventoryUpdate({ ...inventory, category_id: categoryId })).eq("id", id).select("id").maybeSingle());
  if (error) { timing.finish(); return databaseError(error); }
  if (!data) { timing.finish(); return { error: "Item not found or you do not have permission to edit it." }; }
  timing.mark("revalidation_skipped_redirect_reads_fresh_data");
  timing.finish();
  redirect(`/inventory/${id}`);
}

export async function deleteInventoryItemPermanently(id: string): Promise<void> {
  const timing = inventoryMutationTimer("permanent_delete");
  const employee = await timing.phase("authorization", getCurrentEmployee);
  if (!canManageInventory(employee.role)) { timing.finish(); redirect("/dashboard"); }
  const supabase = await createClient();
  const { error } = await timing.phase("database_rpc_and_audit", () => supabase.rpc("delete_inventory_item_permanently", { p_inventory_item_id: id }));
  if (error) { timing.finish(); redirect(`/inventory/${id}?error=${encodeURIComponent(error.message)}`); }
  timing.mark("revalidation_skipped_redirect_reads_fresh_data");
  timing.finish();
  redirect("/inventory");
}

async function bulkContext(operation: "bulk_move" | "bulk_price_change" | "bulk_delete") {
  const timing = inventoryMutationTimer(operation);
  const [{ t }, employee] = await timing.phase("authorization_and_locale", () => Promise.all([getTranslations(), getCurrentEmployee()]));
  return { timing, t, employee };
}

export async function bulkMoveInventoryItems(ids: string[], shopId: string | null): Promise<BulkMoveState> {
  const { timing, t, employee } = await bulkContext("bulk_move");
  if (!canManageInventory(employee.role)) { timing.finish(); return { error: t("inventory.ownerRequired") }; }
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length || uniqueIds.length > 50 || uniqueIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) { timing.finish(); return { error: t("inventory.validSelection") }; }
  if (shopId !== null && !/^[0-9a-f-]{36}$/i.test(shopId)) { timing.finish(); return { error: t("inventory.validDestination") }; }
  const supabase = await createClient();
  const { data, error } = await timing.phase("database_rpc_and_audit", () => supabase.rpc("bulk_move_inventory_items_with_transfer", { p_inventory_item_ids: uniqueIds, p_shop_id: shopId! }));
  timing.mark("revalidation_deferred_to_client_refresh"); timing.finish();
  if (error) return { error: t("inventory.moveFailed") };
  return { error: "", success: t("inventory.moved", { count: uniqueIds.length }), transferId: data ?? undefined };
}

export async function bulkChangePricePerGram(ids: string[], raw: string): Promise<BulkMoveState> {
  const { timing, t, employee } = await bulkContext("bulk_price_change");
  if (!canManageInventory(employee.role)) { timing.finish(); return { error: t("inventory.ownerRequired") }; }
  const unique = [...new Set(ids)], price = Number(raw);
  if (!unique.length || unique.length > 50 || !Number.isFinite(price) || price < 0) { timing.finish(); return { error: t("inventory.validSelection") }; }
  const db = await createClient();
  const { data, error } = await timing.phase("database_rpc_and_audit", () => db.rpc("bulk_change_price_per_gram", { p_inventory_item_ids: unique, p_price_per_gram: price }));
  timing.mark("revalidation_deferred_to_client_refresh"); timing.finish();
  if (error) return { error: error.message };
  return { error: "", success: t("inventory.priceChanged", { count: data ?? 0 }) };
}

export async function bulkDeleteInventoryItems(ids: string[]): Promise<BulkMoveState> {
  const { timing, t, employee } = await bulkContext("bulk_delete");
  if (!canManageInventory(employee.role)) { timing.finish(); return { error: t("inventory.ownerRequired") }; }
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 50) { timing.finish(); return { error: t("inventory.validSelection") }; }
  const db = await createClient();
  const { data, error } = await timing.phase("database_rpc_and_audit", () => db.rpc("bulk_delete_inventory_items", { p_inventory_item_ids: unique }));
  timing.mark("revalidation_deferred_to_client_refresh"); timing.finish();
  if (error) return { error: error.message };
  return { error: "", success: t("inventory.deleted", { count: data ?? 0 }) };
}
