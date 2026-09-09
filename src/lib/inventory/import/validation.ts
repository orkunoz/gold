import type { EmployeeRole, TablesInsert } from "@/lib/database.types";
import { IMPORT_FIELDS, type ColumnMapping, type ImportPreview, type ImportRow, type SpreadsheetCell, type SpreadsheetRow } from "./types";

type Category = { id: string; name: string };
type Shop = { id: string; name: string; code: string | null };
type Context = { mapping: ColumnMapping; targetShopId: string; role: EmployeeRole; employeeShopId: string | null; categories: Category[]; shops: Shop[]; existingBarcodes: Set<string>; headerRow?: number };

function text(value: SpreadsheetCell | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim().slice(0, 2000) || null;
}

export function parseImportedNumber(value: SpreadsheetCell | undefined) {
  if (value === null || value === undefined || value === "") return { value: null as number | null };
  if (typeof value === "number") return Number.isFinite(value) ? { value } : { value: null, error: "Malformed number" };
  let raw = String(value).trim().replace(/(?:грн\.?|uah|₴)$/iu, "").replace(/[\s\u00a0]/g, "");
  if (/^-?\d+,\d+$/.test(raw)) raw = raw.replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return { value: null, error: "Malformed number" };
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? { value: parsed } : { value: null, error: "Malformed number" };
}

export function parseImportedDate(value: SpreadsheetCell | undefined) {
  const raw = text(value);
  if (!raw) return { value: null as string | null };
  let date: Date;
  const ukrainian = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (ukrainian) date = new Date(Date.UTC(Number(ukrainian[3]), Number(ukrainian[2]) - 1, Number(ukrainian[1])));
  else date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { value: null, error: "Invalid date" };
  return { value: date.toISOString() };
}

function normalized(value: string) {
  return value.toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
}

export function matchCategory(value: SpreadsheetCell | undefined, categories: Category[]) {
  const name = text(value);
  if (!name) return { id: null as string | null };
  const category = categories.find((candidate) => normalized(candidate.name) === normalized(name));
  return category ? { id: category.id } : { id: null, warning: `Unknown category “${name}”` };
}

function mapped(row: SpreadsheetRow, mapping: ColumnMapping, field: keyof ColumnMapping) {
  const index = mapping[field];
  return index === undefined ? undefined : row[index];
}

export function validateImportRows(rows: SpreadsheetRow[], context: Context): ImportPreview {
  const barcodeCounts = new Map<string, number>();
  rows.forEach((row) => {
    const barcode = text(mapped(row, context.mapping, "barcode"));
    if (barcode) barcodeCounts.set(barcode, (barcodeCounts.get(barcode) ?? 0) + 1);
  });

  const validated: ImportRow[] = rows.map((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const barcode = text(mapped(row, context.mapping, "barcode"));
    if (!barcode) errors.push("Missing barcode");
    else {
      if ((barcodeCounts.get(barcode) ?? 0) > 1) errors.push("Duplicate barcode in file");
      if (context.existingBarcodes.has(barcode)) errors.push("Barcode already exists");
    }

    let shopId = context.targetShopId;
    const spreadsheetShop = text(mapped(row, context.mapping, "shop"));
    if (spreadsheetShop) {
      const shop = context.shops.find((candidate) => normalized(candidate.name) === normalized(spreadsheetShop) || normalized(candidate.code ?? "") === normalized(spreadsheetShop));
      if (!shop) errors.push(`Unknown shop “${spreadsheetShop}”`);
      else shopId = shop.id;
    }
    if (!context.shops.some((shop) => shop.id === shopId)) errors.push("Invalid target shop");
    if (context.role === "manager" && shopId !== context.employeeShopId) errors.push("Managers may import only to their assigned shop");

    const weight = parseImportedNumber(mapped(row, context.mapping, "weight_grams"));
    const ownerPrice = parseImportedNumber(mapped(row, context.mapping, "owner_price"));
    const sellingPrice = parseImportedNumber(mapped(row, context.mapping, "selling_price"));
    if (weight.error) errors.push("Invalid weight"); else if (weight.value !== null && weight.value < 0) errors.push("Weight cannot be negative");
    if (ownerPrice.error) errors.push("Invalid owner price"); else if (ownerPrice.value !== null && ownerPrice.value < 0) errors.push("Owner price cannot be negative");
    if (sellingPrice.error) errors.push("Invalid selling price"); else if (sellingPrice.value !== null && sellingPrice.value < 0) errors.push("Selling price cannot be negative");
    const received = parseImportedDate(mapped(row, context.mapping, "received_at"));
    if (received.error) errors.push("Invalid received date");
    const category = matchCategory(mapped(row, context.mapping, "category"), context.categories);
    if (category.warning) warnings.push(category.warning);

    const item: ImportRow["item"] = barcode && shopId ? {
      shop_id: shopId, barcode, article_number: text(mapped(row, context.mapping, "article_number")), category_id: category.id,
      gold_fineness: text(mapped(row, context.mapping, "gold_fineness")), gold_color: text(mapped(row, context.mapping, "gold_color")),
      weight_grams: weight.value, size: text(mapped(row, context.mapping, "size")), owner_price: ownerPrice.value,
      selling_price: sellingPrice.value, status: "IN_STOCK", received_at: received.value, notes: text(mapped(row, context.mapping, "notes")),
    } : null;
    return { sourceRow: index + (context.headerRow ?? 0) + 2, classification: errors.length ? "Error" : warnings.length ? "Warning" : "Ready", errors, warnings, item };
  });
  return { rows: validated, summary: {
    total: validated.length,
    ready: validated.filter((row) => row.classification === "Ready").length,
    warnings: validated.filter((row) => row.classification === "Warning").length,
    errors: validated.filter((row) => row.classification === "Error").length,
    duplicates: validated.filter((row) => row.errors.some((error) => error.toLocaleLowerCase().includes("duplicate") || error.includes("already exists"))).length,
  } };
}

export function validMapping(input: unknown): input is ColumnMapping {
  if (!input || typeof input !== "object") return false;
  return Object.entries(input).every(([field, index]) => IMPORT_FIELDS.includes(field as typeof IMPORT_FIELDS[number]) && Number.isInteger(index) && Number(index) >= 0);
}

export function toInsert(item: NonNullable<ImportRow["item"]>, createdBy: string): TablesInsert<"inventory_items"> {
  return { ...item, created_by: createdBy };
}
