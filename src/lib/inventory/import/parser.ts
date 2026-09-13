import { createTranslator, type Locale } from "@/lib/i18n/core";
import "server-only";

import readXlsxFile from "read-excel-file/node";
import { detectHeaderRow, suggestColumnMapping, uniqueHeaders } from "./headers";
import type { ParsedSheet, SpreadsheetCell, SpreadsheetRow } from "./types";

export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

function cellValue(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value).trim().slice(0, 2000);
}

export async function parseInventoryWorkbook(file: File, requestedSheet?: string, locale: Locale = "en"): Promise<ParsedSheet> {
  const t = createTranslator(locale);
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) throw new Error(t("import.messages.fileType"));
  if (file.size === 0) throw new Error(t("import.messages.emptyFile"));
  if (file.size > MAX_IMPORT_FILE_SIZE) throw new Error(t("import.messages.fileSize"));

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(t("import.messages.invalidWorkbook"));

  let workbook;
  try {
    workbook = await readXlsxFile(Buffer.from(bytes));
  } catch {
    throw new Error(t("import.messages.unreadable"));
  }
  if (workbook.length === 0) throw new Error(t("import.messages.noSheets"));

  const selected = workbook.find((sheet) => sheet.sheet === requestedSheet) ?? workbook[0];
  const allRows = selected.data.map((row) => row.map(cellValue)) as SpreadsheetRow[];
  const headerRow = detectHeaderRow(allRows);
  const headers = uniqueHeaders(allRows[headerRow] ?? [], locale);
  const source = allRows.slice(headerRow + 1).map((row, index) => ({ row, sourceRow: headerRow + index + 2 }));
  const nonempty = source.filter(({ row }) => row.some((cell) => cell !== null && String(cell).trim() !== ""));
  const rows = nonempty.map(({ row }) => row);
  const sourceRows = nonempty.map(({ sourceRow }) => sourceRow);
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(t("import.messages.rowLimit",{count:MAX_IMPORT_ROWS}));
  return { sheetNames: workbook.map((sheet) => sheet.sheet), selectedSheet: selected.sheet, headerRow, headers, suggestedMapping: suggestColumnMapping(headers), rows, sourceRows };
}
