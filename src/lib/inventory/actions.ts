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

function databaseError(error: { code?: string } | null): InventoryActionState {
  if (error?.code === "23505") {
    return { error: "An item with this barcode already exists.", fieldErrors: { barcode: "Barcode must be unique." } };
  }
  if (error?.code === "42501") return { error: "You do not have permission to make this change." };
  return { error: "Unable to save this item. Please try again." };
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
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ ...validation.data, created_by: employee.id })
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
  const { data, error } = await supabase
    .from("inventory_items")
    .update(toInventoryUpdate(validation.data))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return { error: "Item not found or you do not have permission to edit it." };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}
