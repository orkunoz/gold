import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("ZLATA V2.1.1 dashboard and table polish", () => {
  it("keeps inventory distribution outside reporting inputs and uses one grouped count request", () => {
    const page = read("../app/(protected)/dashboard/page.tsx");
    const queries = read("../lib/dashboard/queries.ts");
    expect(page).toContain("getInventoryLocationCounts()");
    expect(page).toContain("getActiveLocations()");
    expect(queries).toContain('rpc("get_admin_shop_counts")');
    expect(queries).not.toMatch(/inventory_items.*select/);
    expect(page).not.toMatch(/getInventoryLocationCounts\([^)]*(period|shopId)/);
  });

  it("uses the exact Shop Performance order and semantic numeric alignment", () => {
    const page = read("../app/(protected)/dashboard/page.tsx");
    const header = page.slice(page.indexOf('t("dashboard.shopPerformance")'), page.indexOf("</thead>", page.indexOf('t("dashboard.shopPerformance")')));
    const order = ["fields.shop", "dashboard.itemsSold", "dashboard.goldWeightSold", "dashboard.revenue", "dashboard.inStockGoldWeight", "dashboard.trend"];
    for (let index = 1; index < order.length; index += 1) expect(header.indexOf(`t("${order[index]}")`)).toBeGreaterThan(header.indexOf(`t("${order[index - 1]}")`));
    expect(read("../app/globals.css")).toContain(".zl-table .zl-table-number { text-align:right");
  });

  it("resets zero count-up targets and animates sold items and weight with the shared primitive", () => {
    const metric = read("./metric-count-up.tsx");
    const page = read("../app/(protected)/dashboard/page.tsx");
    expect(metric).toContain("animation.target === value ? animation.display : 0");
    expect(metric).toContain("METRIC_COUNT_UP_DURATION = 650");
    expect(metric).toContain("prefers-reduced-motion: reduce");
    expect(page).toContain("statisticsPresentation");
    expect(page).toContain("key={`weight:${statisticsPresentation}`}");
    expect(page).toContain('value={report.kpis.items_sold} locale={locale} kind="number"');
    expect(page).toContain('value={report.kpis.gold_weight_sold} locale={locale} kind="weight"');
  });

  it("keeps chart tooltips visible while anchoring near-edge points", () => {
    const chart = read("./sales-trend.tsx");
    expect(chart).toContain("overflow-visible");
    expect(chart).toContain("position < 15");
    expect(chart).toContain("position > 85");
  });
});
