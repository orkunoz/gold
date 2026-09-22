import type { InventoryStatus, TablesInsert, TablesUpdate } from "@/lib/database.types";
import { INVENTORY_STATUSES } from "./constants";
import { parseRequiredPurchasePrice } from "./purchase-price";

export type InventoryFormValues = Record<string, string>;
export type InventoryFormErrors = Partial<Record<string, string>>;

type ValidatedInventory = Omit<TablesInsert<"inventory_items">, "created_by" | "category_id"> & { category_name: string | null };

export type InventoryValidationResult =
  | { success: true; data: ValidatedInventory }
  | { success: false; errors: InventoryFormErrors; values: InventoryFormValues };

const TEXT_FIELDS = [
  "shop_id",
  "barcode",
  "article_number",
  "category_name",
  "gold_color",
  "metal",
  "producer",
  "weight_grams",
  "size",
  "owner_price",
  "selling_price",
  "price_per_gram",
  "purchase_price",
  "status",
  "received_at",
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
  if (values.barcode.length > 200) errors.barcode = "Barcode is too long.";
  const status = values.status as InventoryStatus;
  if (!INVENTORY_STATUSES.includes(status)) errors.status = "Select a valid status.";

  const weight = parseNonnegativeNumber("weight_grams", "Weight", values, errors);
  const ownerPrice = parseNonnegativeNumber("owner_price", "Owner price", values, errors);
  const sellingPrice = parseNonnegativeNumber("selling_price", "Selling price", values, errors);
  const pricePerGram = parseNonnegativeNumber("price_per_gram", "Price per gram", values, errors);
  const purchasePrice = values.purchase_price ? parseRequiredPurchasePrice(values.purchase_price) : null;
  if (values.purchase_price && purchasePrice === null) errors.purchase_price = "Purchase price must be a valid non-negative monetary amount.";

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
      shop_id: nullableText(values.shop_id),
      barcode: nullableText(values.barcode),
      article_number: nullableText(values.article_number),
      category_name: nullableText(values.category_name)?.replace(/\s+/g, " ") ?? null,
      gold_color: nullableText(values.gold_color),
      metal: nullableText(values.metal),
      producer: nullableText(values.producer),
      weight_grams: weight,
      size: nullableText(values.size),
      owner_price: ownerPrice,
      selling_price: sellingPrice,
      price_per_gram: pricePerGram,
      purchase_price: purchasePrice,
      status,
      received_at: receivedAt,
    },
  };
}

export function toInventoryUpdate(data: Omit<ValidatedInventory, "category_name"> & { category_id: string | null }): TablesUpdate<"inventory_items"> {
  return data;
}
