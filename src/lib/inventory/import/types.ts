import type { InventoryStatus } from "@/lib/database.types";

export const IMPORT_FIELDS = [
  "barcode", "article_number", "category", "gold_fineness", "gold_color",
  "weight_grams", "size", "owner_price", "selling_price", "received_at", "notes", "shop",
] as const;

export type ImportField = typeof IMPORT_FIELDS[number];
export type ColumnMapping = Partial<Record<ImportField, number>>;
export type SpreadsheetCell = string | number | boolean | null;
export type SpreadsheetRow = SpreadsheetCell[];

export type ParsedSheet = {
  sheetNames: string[];
  selectedSheet: string;
  headerRow: number;
  headers: string[];
  suggestedMapping: ColumnMapping;
  rows: SpreadsheetRow[];
};

export type ImportRow = {
  sourceRow: number;
  classification: "Ready" | "Warning" | "Error";
  warnings: string[];
  errors: string[];
  item: {
    shop_id: string;
    barcode: string;
    article_number: string | null;
    category_id: string | null;
    gold_fineness: string | null;
    gold_color: string | null;
    weight_grams: number | null;
    size: string | null;
    owner_price: number | null;
    selling_price: number | null;
    status: InventoryStatus;
    received_at: string | null;
    notes: string | null;
  } | null;
};

export type ImportPreview = {
  rows: ImportRow[];
  summary: { total: number; ready: number; warnings: number; errors: number; duplicates: number };
};

