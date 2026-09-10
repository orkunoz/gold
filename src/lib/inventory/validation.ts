import type { InventoryStatus, TablesInsert, TablesUpdate } from "@/lib/database.types";
import { INVENTORY_STATUSES } from "./constants";

export type InventoryFormValues = Record<string, string>;
export type InventoryFormErrors = Partial<Record<string, string>>;

type ValidatedInventory = Omit<TablesInsert<"inventory_items">, "created_by">;

export type InventoryValidationResult =
  | { success: true; data: ValidatedInventory }
  | { success: false; errors: InventoryFormErrors; values: InventoryFormValues };

const TEXT_FIELDS = [
  "shop_id",
  "barcode",
  "article_number",
  "category_id",
  "gold_fineness",
  "gold_color",
  "metal",
  "producer",
  "weight_grams",
  "size",
  "owner_price",
  "selling_price",
  "price_per_gram",
  "discount",
  "status",
  "received_at",
  "notes",
] as const;

function nullableText(value: string) {
  return value === "" ? null : value;
}
function parseNonnegativeNumber(
  name: string,
  label: string,
  values: InventoryFormValues,
  errors: InventoryFormErrors,
) {
  const raw = values[name];
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors[name] = `${label} must be a valid non-negative number.`;
    return null;
  }
  return parsed;
}

export function validateInventoryForm(formData: FormData): InventoryValidationResult {
  const values: InventoryFormValues = {};
  for (const field of TEXT_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value.trim() : "";
  }

  const errors: InventoryFormErrors = {};
  if (!values.shop_id) errors.shop_id = "Select a shop.";
  if (values.barcode.length > 200) errors.barcode = "Barcode is too long.";
  if (values.metal && !["Gold", "Silver"].includes(values.metal)) errors.metal = "Select Gold or Silver.";

  const status = values.status as InventoryStatus;
  if (!INVENTORY_STATUSES.includes(status)) errors.status = "Select a valid status.";

  const weight = parseNonnegativeNumber("weight_grams", "Weight", values, errors);
  const ownerPrice = parseNonnegativeNumber("owner_price", "Owner price", values, errors);
  const sellingPrice = parseNonnegativeNumber("selling_price", "Selling price", values, errors);
  const pricePerGram = parseNonnegativeNumber("price_per_gram", "Price per gram", values, errors);

  let receivedAt: string | null = null;
  if (values.received_at) {
    const date = new Date(`${values.received_at}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) errors.received_at = "Enter a valid received date.";
    else receivedAt = date.toISOString();
  }

  if (Object.keys(errors).length > 0) return { success: false, errors, values };

  return {
    success: true,
    data: {
      shop_id: values.shop_id,
      barcode: nullableText(values.barcode),
      article_number: nullableText(values.article_number),
      category_id: nullableText(values.category_id),
      gold_fineness: nullableText(values.gold_fineness),
      gold_color: nullableText(values.gold_color),
      metal: nullableText(values.metal) as "Gold" | "Silver" | null,
      producer: nullableText(values.producer),
      weight_grams: weight,
      size: nullableText(values.size),
      owner_price: ownerPrice,
      selling_price: sellingPrice,
      price_per_gram: pricePerGram,
      discount: nullableText(values.discount),
      status,
      received_at: receivedAt,
      notes: nullableText(values.notes),
    },
  };
}

export function toInventoryUpdate(data: ValidatedInventory): TablesUpdate<"inventory_items"> {
  return data;
}
