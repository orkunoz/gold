import { createTranslator, type Locale } from "@/lib/i18n/core";

const fields: Record<string, string> = {
  "CREATED": "history.fields.created",
  "Product Category": "fields.productCategory",
  "Metal": "fields.metal",
  "Fineness": "fields.fineness",
  "Producer": "fields.producer",
  "Size": "fields.size",
  "Article": "fields.article",
  "Weight": "fields.weight",
  "Price per Gram": "fields.pricePerGram",
  "Inventory Price": "history.fields.inventoryPrice",
  "Inventory Discount": "history.fields.inventoryDiscount",
  "Status": "fields.status",
  "Shop": "fields.shop",
  "Barcode": "fields.barcode",
  "Notes": "fields.notes",
  "Owner/base price": "history.fields.ownerPrice",
  "Manual selling price": "history.fields.sellingPrice"
};
const sources = new Set(["MANUAL_EDIT", "XLSX_IMPORT", "SALE", "STATUS_CHANGE", "SHOP_TRANSFER", "SYSTEM"]);
export function historyField(field: string, locale: Locale) {
  return fields[field] ? createTranslator(locale)(fields[field]) : field;
}
export function historySource(source: string, locale: Locale) {
  return sources.has(source) ? createTranslator(locale)(`history.sources.${source}`) : source;
}
export function historyValue(field: string, value: string | null, locale: Locale) {
  const t = createTranslator(locale);
  if (value === null) return "—";
  if (field.toLowerCase() === "status" && ["IN_STOCK", "SOLD", "REMOVED"].includes(value)) return t(`status.${value}`);
  if (field === "CREATED" && value === "Inventory item created") return t("history.created");
  return value;
}
