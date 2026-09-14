import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("dashboard and administration location display", () => {
  it("localizes dashboard shop report values and removes recent-sale accounts", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    expect(dashboard).toContain("historicalLocationDisplayName(row.shop,locale)");
    expect(dashboard).toContain("historicalLocationDisplayName(sale.shop,locale)");
    expect(dashboard).not.toContain('t("admin.accounts")');
    expect(dashboard).not.toContain("{sale.employee}");
  });

  it("localizes shop names in Administration without mutating records", () => {
    const shops = read("../app/(protected)/admin/shops/page.tsx");
    expect(shops).toContain("locationDisplayName(shop,locale)");
  });
});
