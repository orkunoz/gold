import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("ZLATA V2.4 responsive refinement", () => {
  it("uses one shell container and removes the skip-link feature", () => {
    const layout = read("../app/(protected)/layout.tsx");
    const css = read("../app/globals.css");
    expect(layout.match(/zl-app-container/g)).toHaveLength(2);
    expect(css).toContain(".zl-app-container");
    expect(layout).not.toContain("zl-skip-link");
    expect(css).not.toContain("zl-skip-link");
  });

  it("keeps Shop Performance informational and cleans the Inventory header", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    const shopSection = dashboard.slice(dashboard.indexOf("sections.shopPerformance"), dashboard.indexOf("sections.comparisons"));
    expect(shopSection).not.toContain("dashboard.viewAll");
    expect(dashboard).not.toContain("dashboard.notPeriodFiltered");
    expect(dashboard).toContain('className="whitespace-nowrap font-semibold"');
    expect(dashboard).not.toContain("dashboard.recentSalesSubtitle");
  });

  it("renders complete snapshot-based Sale Detail without Notes or purchase cost", () => {
    const page = read("../app/(protected)/sales/[id]/page.tsx");
    const query = read("../lib/sales/queries.ts");
    for (const field of ["category_name", "article_number", "producer", "size", "weight_grams", "barcode", "list_price", "discount_percent", "sale_price"]) expect(query).toContain(field);
    expect(page).toContain("data-sale-detail");
    expect(page).toContain('t("status.SOLD")');
    expect(page).not.toContain("sales.noNotes");
    expect(page).not.toContain("sale.notes");
    expect(page).not.toContain("purchase_price");
  });

  it("uses linked identifiers, creator-after-date ordering, and no View actions", () => {
    const page = read("../app/(protected)/documents/page.tsx");
    expect(page).toContain("/transfers/${row.id}");
    expect(page).toContain("/documents/added-products/${row.id}");
    expect(page.indexOf('t("fields.createdDate")')).toBeLessThan(page.indexOf('t("documents.createdBy")'));
    expect(page).not.toContain('t("documents.view")');
  });

  it("keeps overlays mounted through close and protects printable long values", () => {
    const popover = read("./ui/popover-surface.tsx");
    const css = read("../app/globals.css");
    const transfer = read("./transfer-note.tsx");
    const receipt = read("./added-products-note.tsx");
    expect(popover).toContain('"idle" | "open" | "closing"');
    expect(css).toContain("visibility 0s linear .16s");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain("z-index:1000");
    expect(transfer).toContain("transfer-note--compact-table");
    expect(transfer).toContain("overflow-wrap:anywhere");
    expect(receipt).toContain("transfer-note__col--barcode{width:17%}");
    expect(receipt).toContain("ADDED_PRODUCTS_COLUMNS");
  });
});
