"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageInventory, getCurrentEmployee } from "./queries";
import { toInventoryUpdate, validateInventoryForm, type InventoryFormErrors } from "./validation";

export type InventoryActionState = {
  error: string;
  fieldErrors?: InventoryFormErrors;
};

export type BulkMoveState = { error: string; success?: string };

function databaseError(error: { code?: string } | null): InventoryActionState {
  if (error?.code === "23505") {
    return { error: "An item with this barcode already exists.", fieldErrors: { barcode: "Barcode must be unique." } };
  }
  if (error?.code === "42501") return { error: "You do not have permission to make this change." };
  return { error: "Unable to save this item. Please try again." };
}

async function resolveCategory(client: Awaited<ReturnType<typeof createClient>>, name: string | null) {
  if (!name) return null;
  const { data, error } = await client.rpc("resolve_product_category", { p_name: name });
  if (error || !data) throw new Error("Unable to resolve product category.");
  return data;
}

export async function createInventoryItem(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return { error: "You do not have permission to add inventory." };

  const validation = validateInventoryForm(formData);
  if (!validation.success) return { error: "Check the highlighted fields.", fieldErrors: validation.errors };
  const supabase = await createClient();
  let categoryId: string | null;
  try { categoryId = await resolveCategory(supabase, validation.data.category_name); }
  catch { return { error: "Unable to create or select this category." }; }
  const { category_name: categoryName, ...inventory } = validation.data;
  void categoryName;
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ ...inventory, category_id: categoryId, created_by: employee.id })
    .select("id")
    .single();
  if (error || !data) return databaseError(error);

  revalidatePath("/inventory");
  redirect(`/inventory/${data.id}`);
}

export async function updateInventoryItem(
  id: string,
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return { error: "You do not have permission to edit inventory." };

  const validation = validateInventoryForm(formData);
  if (!validation.success) return { error: "Check the highlighted fields.", fieldErrors: validation.errors };
  const supabase = await createClient();
  let categoryId: string | null;
  try { categoryId = await resolveCategory(supabase, validation.data.category_name); }
  catch { return { error: "Unable to create or select this category." }; }
  const { category_name: categoryName, ...inventory } = validation.data;
  void categoryName;
  const { data, error } = await supabase
    .from("inventory_items")
    .update(toInventoryUpdate({ ...inventory, category_id: categoryId }))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return { error: "Item not found or you do not have permission to edit it." };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}

export async function deleteInventoryItemPermanently(id: string): Promise<void> {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) redirect("/dashboard");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_inventory_item_permanently", { p_inventory_item_id: id });
  if (error) redirect(`/inventory/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect("/inventory");
}

export async function bulkMoveInventoryItems(ids: string[], shopId: string | null): Promise<BulkMoveState> {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return { error: "Owner access required." };
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length || uniqueIds.length > 50 || uniqueIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) return { error: "Select between 1 and 50 valid products." };
  if (shopId !== null && !/^[0-9a-f-]{36}$/i.test(shopId)) return { error: "Select a valid destination shop." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_move_inventory_items", { p_inventory_item_ids: uniqueIds, p_shop_id: shopId });
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return { error: "", success: `${data ?? 0} product${data === 1 ? "" : "s"} moved.` };
}
