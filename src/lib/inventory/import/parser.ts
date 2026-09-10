import "server-only";

import readXlsxFile from "read-excel-file/node";
import { detectHeaderRow, suggestColumnMapping, uniqueHeaders } from "./headers";
import type { ParsedSheet, SpreadsheetCell, SpreadsheetRow } from "./types";
import { removeEmptySpreadsheetRows } from "./validation";

export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

function cellValue(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value).trim().slice(0, 2000);
}

export async function parseInventoryWorkbook(file: File, requestedSheet?: string): Promise<ParsedSheet> {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) throw new Error("Upload an .xlsx Excel file.");
  if (file.size === 0) throw new Error("The uploaded file is empty.");
  if (file.size > MAX_IMPORT_FILE_SIZE) throw new Error("The Excel file must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("The uploaded file is not a valid .xlsx workbook.");

  let workbook;
  try {
    workbook = await readXlsxFile(Buffer.from(bytes));
  } catch {
    throw new Error("The workbook could not be read. Save it as a standard .xlsx file and try again.");
  }
  if (workbook.length === 0) throw new Error("The workbook has no worksheets.");

  const selected = workbook.find((sheet) => sheet.sheet === requestedSheet) ?? workbook[0];
  const allRows = selected.data.map((row) => row.map(cellValue)) as SpreadsheetRow[];
  const headerRow = detectHeaderRow(allRows);
  const headers = uniqueHeaders(allRows[headerRow] ?? []);
  const rows = removeEmptySpreadsheetRows(allRows.slice(headerRow + 1));
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`A worksheet may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  return { sheetNames: workbook.map((sheet) => sheet.sheet), selectedSheet: selected.sheet, headerRow, headers, suggestedMapping: suggestColumnMapping(headers), rows };
}
