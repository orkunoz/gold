import type { InventoryStatus } from "@/lib/database.types";

export const IMPORT_FIELDS = [
  "category", "metal", "producer", "size", "weight_grams", "price_per_gram",
  "article_number", "discount", "notes", "status", "shop", "barcode",
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
    barcode: string | null;
    article_number: string | null;
    category_id: string | null;
    category_name: string | null;
    metal: "Gold" | "Silver" | null;
    producer: string | null;
    weight_grams: number | null;
    size: string | null;
    price_per_gram: number | null;
    price: number | null;
    discount: string | null;
    status: InventoryStatus;
    notes: string | null;
    shop_name: string;
  } | null;
};

export type ImportPreview = {
  rows: ImportRow[];
  summary: { total: number; ready: number; warnings: number; errors: number; duplicates: number };
};
