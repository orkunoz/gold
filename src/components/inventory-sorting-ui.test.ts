import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("inventory defaults and sorting", () => {
  it("defaults a missing status to in stock and preserves explicit all", () => {
    const page = read("../app/(protected)/inventory/page.tsx");
    expect(page).toContain('hasStatus ? "ALL" : "IN_STOCK"');
    expect(page).toContain('rawStatus === "ALL"');
  });

  it("defaults to Created Date descending while preserving explicit alternatives", () => {
    const page = read("../app/(protected)/inventory/page.tsx");
    expect(page).toContain('? rawSort as InventorySort : "createdDate"');
    expect(page).toContain('parameter(params, "direction") === "asc" ? "asc" : "desc"');
    expect(page).toContain('getInventoryItems(filters, page, 25, sort, direction)');
  });

  it("sorts before the database range and protects purchase price sorting", () => {
    const queries = read("../lib/inventory/queries.ts");
    expect(queries.indexOf('.order(inventorySortColumns[sort]')).toBeLessThan(queries.indexOf('.range(from, from + pageSize - 1)'));
    expect(queries).toContain('productCategory: "product_categories(name)"');
    expect(queries).toContain('shop: "shops(name)"');
    const page = read("../app/(protected)/inventory/page.tsx");
    expect(page).toContain('requestedSort === "purchasePrice" && employee.role !== "owner"');
  });

  it("only renders purchase price and its sortable header for owners", () => {
    const table = read("./inventory-bulk-table.tsx");
    expect(table).toContain('...(canManage?["purchasePrice"]:[])');
    expect(table).toContain('{canManage?<td');
  });
});
