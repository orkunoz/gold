import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("ZLATA V2.1 light visual system", () => {
  it("loads the requested optimized type system", () => {
    const layout = read("../app/layout.tsx");
    expect(layout).toContain("DM_Serif_Display");
    expect(layout).toContain("Manrope");
    expect(layout).toContain('subsets: ["cyrillic", "latin"]');
  });

  it("places global Dashboard filters in Statistics and removes redundant copy", () => {
    const page = read("../app/(protected)/dashboard/page.tsx");
    const statistics = page.indexOf('id="statistics-title"');
    const filters = page.indexOf("<DashboardFilters", statistics);
    expect(filters).toBeGreaterThan(statistics);
    expect(page).not.toContain('t("dashboard.itemsOverTime")');
    expect(page).toContain('t("dashboard.inventoryValue")');
    expect(page).not.toContain("className=\"eyebrow\"");
  });

  it("handles one-point shop trends and keeps zero data empty", () => {
    const page = read("../app/(protected)/dashboard/page.tsx");
    expect(page).toContain("values.every(value => value === 0)");
    expect(page).toContain("values.length === 1");
    expect(page).toContain("<circle");
  });

  it("uses shared table and control families in operational views", () => {
    for (const path of ["inventory-bulk-table.tsx", "sales-checkout.tsx"]) {
      expect(read(`./${path}`)).toContain("zl-table");
    }
    expect(read("./ui/button.tsx")).toContain("zl-button--");
    expect(read("./metric-count-up.tsx")).toContain("prefers-reduced-motion");
  });
});
