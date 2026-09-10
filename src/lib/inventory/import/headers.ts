import type { ColumnMapping, ImportField, SpreadsheetRow } from "./types";

const aliases: Record<ImportField, string[]> = {
  barcode: ["barcode", "bar code", "штрихкод", "штрих код", "штрих-код", "код"],
  article_number: ["article", "article number", "article no", "артикул", "номер артикула"],
  category: ["category", "product", "product category", "виріб", "вироб", "категорія", "найменування"],
  metal: ["metal", "метал", "металл"],
  producer: ["producer", "manufacturer", "виробник", "производитель"],
  weight_grams: ["weight", "weight grams", "weight g", "вага", "вага г", "вес"],
  size: ["size", "розмір", "размер"],
  price_per_gram: ["price per gram", "price/g", "ціна грам", "ціна за грам", "цена грам"],
  price: ["price", "ціна", "ціна грн", "цена"],
  discount: ["discount", "знижка", "скидка"],
  notes: ["notes", "note", "comment", "примітка", "примітки", "коментар"],
  shop: ["shop", "store", "location", "магазин", "крамниця"],
  status: ["status", "статус"],
};

export function normalizeHeader(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("uk-UA").replace(/[_.\/\\-]+/g, " ").replace(/\s+/g, " ").trim();
}

const aliasLookup = new Map<string, ImportField>();
for (const [field, names] of Object.entries(aliases) as [ImportField, string[]][]) {
  names.forEach((name) => aliasLookup.set(normalizeHeader(name), field));
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((header, index) => {
    const field = aliasLookup.get(normalizeHeader(header));
    if (field && mapping[field] === undefined) mapping[field] = index;
  });
  return mapping;
}

export function detectHeaderRow(rows: SpreadsheetRow[]) {
  let best = { index: 0, score: -1 };
  rows.slice(0, 20).forEach((row, index) => {
    const recognized = row.filter((cell) => aliasLookup.has(normalizeHeader(cell))).length;
    const populated = row.filter((cell) => normalizeHeader(cell) !== "").length;
    const score = recognized * 10 + Math.min(populated, 9);
    if (score > best.score) best = { index, score };
  });
  return best.index;
}

export function uniqueHeaders(row: SpreadsheetRow) {
  const used = new Map<string, number>();
  return row.map((cell, index) => {
    const base = String(cell ?? "").trim() || `Column ${index + 1}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}
