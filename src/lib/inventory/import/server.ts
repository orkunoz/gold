import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getInventoryOptions } from "@/lib/inventory/queries";
import { MAX_IMPORT_ROWS } from "./parser";
import { validMapping, validateImportRows } from "./validation";
import type { ColumnMapping, SpreadsheetRow } from "./types";

export type ImportPayload = { rows: SpreadsheetRow[]; sourceRows: number[]; mapping: ColumnMapping; targetShopId: string; headerRow?: number };

export function parseImportPayload(input: unknown): ImportPayload | null {
  if (!input || typeof input !== "object") return null;
  const payload = input as Partial<ImportPayload>;
  if (!Array.isArray(payload.rows) || payload.rows.length > MAX_IMPORT_ROWS || !Array.isArray(payload.sourceRows) || payload.sourceRows.length !== payload.rows.length || payload.sourceRows.some((row) => !Number.isInteger(row) || row < 1) || !validMapping(payload.mapping) || typeof payload.targetShopId !== "string") return null;
  const safeRows = payload.rows.every((row) => Array.isArray(row) && row.length <= 100 && row.every((cell) => cell === null || ["string", "number", "boolean"].includes(typeof cell)));
  if (!safeRows) return null;
  return { rows: payload.rows, sourceRows: payload.sourceRows, mapping: payload.mapping, targetShopId: payload.targetShopId, headerRow: Number.isInteger(payload.headerRow) ? payload.headerRow : 0 };
}

export async function buildImportPreview(payload: ImportPayload) {
  const supabase = await createClient();
  const options = await getInventoryOptions();
  const barcodeIndex = payload.mapping.barcode;
  const barcodes = barcodeIndex === undefined ? [] : [...new Set(payload.rows.map((row) => String(row[barcodeIndex] ?? "").trim()).filter(Boolean))];
  const existingBarcodes = new Set<string>();
  for (let index = 0; index < barcodes.length; index += 200) {
    const { data, error } = await supabase.from("inventory_items").select("barcode").in("barcode", barcodes.slice(index, index + 200));
    if (error) throw new Error("Unable to check existing barcodes.");
    data?.forEach((item) => { if (item.barcode) existingBarcodes.add(item.barcode); });
  }
  return validateImportRows(payload.rows, {
    mapping: payload.mapping, targetShopId: payload.targetShopId, categories: options.categories, shops: options.shops,
    existingBarcodes, headerRow: payload.headerRow, sourceRows: payload.sourceRows,
  });
}
