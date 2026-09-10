import type { EmployeeRole, InventoryStatus, TablesInsert } from "@/lib/database.types";
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
  if (ukrainian) {
    const day = Number(ukrainian[1]);
    const month = Number(ukrainian[2]);
    const year = Number(ukrainian[3]);
    date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return { value: null, error: "Invalid date" };
    }
  } else date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { value: null, error: "Invalid date" };
  return { value: date.toISOString() };
}

function normalized(value: string) {
  return value.toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
}

export function matchCategory(value: SpreadsheetCell | undefined, categories: Category[]) {
  const name = text(value);
  if (!name) return { id: null as string | null };
  const aliases: Record<string,string>={"каблучка":"ring","каблучки":"ring","сережки":"earrings","ланцюжок":"chain","ланцюг":"chain","браслет":"bracelet","браслети":"bracelet","підвіска":"pendant","кольє":"necklace","намисто":"necklace"};
  const target=aliases[normalized(name)]??normalized(name);
  const category = categories.find((candidate) => normalized(candidate.name) === target);
  return category ? { id: category.id, name: category.name } : { id: null, name, warning: `Unknown category “${name}”` };
}

export function normalizeImportedMetal(value: SpreadsheetCell | undefined) {
  const raw = text(value);
  if (!raw) return { value: null as "Gold" | "Silver" | null };
  const key = normalized(raw);
  if (["gold", "золото"].includes(key)) return { value: "Gold" as const };
  if (["silver", "срібло"].includes(key)) return { value: "Silver" as const };
  return { value: null, warning: `Unknown metal “${raw}”` };
}

export function normalizeImportedStatus(value: SpreadsheetCell | undefined) {
  const raw = text(value);
  if (!raw) return { value: "IN_STOCK" as InventoryStatus };
  const key = normalized(raw).replace(/[ -]+/g, "_").toUpperCase();
  const aliases: Record<string, InventoryStatus> = {
    IN_STOCK: "IN_STOCK", INSTOCK: "IN_STOCK", SOLD: "SOLD", RESERVED: "RESERVED", REMOVED: "REMOVED",
    "В_НАЯВНОСТІ": "IN_STOCK", ПРОДАНО: "SOLD", ЗАРЕЗЕРВОВАНО: "RESERVED", ВИДАЛЕНО: "REMOVED",
  };
  return aliases[key] ? { value: aliases[key] } : { value: "IN_STOCK" as InventoryStatus, warning: `Unknown status “${raw}”; using IN_STOCK` };
}

export function calculateInventoryPrice(weight:number|null,pricePerGram:number|null){return weight===null||pricePerGram===null?null:Math.round(weight*pricePerGram*100)/100;}

function mapped(row: SpreadsheetRow, mapping: ColumnMapping, field: keyof ColumnMapping) {
  const index = mapping[field];
  return index === undefined ? undefined : row[index];
}

export function removeEmptySpreadsheetRows(rows: SpreadsheetRow[]) {
  return rows.filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== ""));
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
    if (barcode) {
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

    const weight = parseImportedNumber(mapped(row, context.mapping, "weight_grams"));
    const pricePerGram = parseImportedNumber(mapped(row, context.mapping, "price_per_gram"));
    if (weight.error) warnings.push("Invalid weight; storing blank"); else if (weight.value !== null && weight.value < 0) errors.push("Weight cannot be negative");
    if (pricePerGram.error) warnings.push("Invalid price per gram; storing blank"); else if (pricePerGram.value !== null && pricePerGram.value < 0) errors.push("Price per gram cannot be negative");
    const category = matchCategory(mapped(row, context.mapping, "category"), context.categories);
    if (category.warning) warnings.push(category.warning);
    const metal = normalizeImportedMetal(mapped(row, context.mapping, "metal"));
    if (metal.warning) warnings.push(metal.warning);
    const status = normalizeImportedStatus(mapped(row, context.mapping, "status"));
    if (status.warning) warnings.push(status.warning);
    if (status.value === "SOLD") errors.push("SOLD status can only be created by completing a sale");

    const item: ImportRow["item"] = shopId ? {
      shop_id: shopId, shop_name: context.shops.find((shop) => shop.id === shopId)?.name ?? "Unknown", barcode, article_number: text(mapped(row, context.mapping, "article_number")), category_id: category.id, category_name: category.name ?? null,
      metal: metal.value, producer: text(mapped(row, context.mapping, "producer")),
      weight_grams: weight.error ? null : weight.value, size: text(mapped(row, context.mapping, "size")),
      price_per_gram: pricePerGram.error ? null : pricePerGram.value,
      price: weight.error || pricePerGram.error ? null : calculateInventoryPrice(weight.value,pricePerGram.value),
      discount: text(mapped(row, context.mapping, "discount")), status: status.value, notes: text(mapped(row, context.mapping, "notes")),
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
  return {
    shop_id: item.shop_id, barcode: item.barcode, article_number: item.article_number, category_id: item.category_id,
    metal: item.metal, producer: item.producer, size: item.size, weight_grams: item.weight_grams,
    price_per_gram: item.price_per_gram, price: item.price, discount: item.discount, notes: item.notes,
    status: item.status, created_by: createdBy,
  };
}
