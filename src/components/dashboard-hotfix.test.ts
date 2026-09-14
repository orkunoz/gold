import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("dashboard live-filter and compact-layout hotfix", () => {
  it("uses client navigation, preserves URL state, and prevents a document form submit", () => {
    const source = read("./dashboard-filters.tsx");
    expect(source).toContain("useRouter");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("new URLSearchParams(searchParams.toString())");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("router.push");
    expect(source).toContain("useTransition");
    expect(source).not.toMatch(/action=|window\.location|location\.href/);
  });

  it("keeps Custom Range fields conditional and applies dropdowns immediately", () => {
    const source = read("./dashboard-filters.tsx");
    expect(source).toContain('period === "CUSTOM"');
    expect(source).toContain('value !== "CUSTOM"');
    expect(source).toContain("changeShop(event.target.value)");
    expect(source).toContain('name="start"');
    expect(source).toContain('name="end"');
  });

  it("uses the requested KPI, inventory, analytics, and shop table structure", () => {
    const source = read("../app/(protected)/dashboard/page.tsx");
    expect(source).toContain("data-dashboard-kpis");
    expect(source).toContain("lg:grid-cols-4");
    expect(source).toContain("data-dashboard-inventory");
    expect(source).toContain("sm:grid-cols-3");
    expect(source).toContain("data-dashboard-analytics");
    expect(source).toContain("lg:grid-cols-2");
    expect(source).toContain('t("dashboard.itemsSold")');
    expect(source).not.toMatch(/Status summary|status_counts/);
  });

  it("preserves role scoping and the chart hotfix", () => {
    const page = read("../app/(protected)/dashboard/page.tsx");
    const chart = read("./sales-trend.tsx");
    expect(page).toContain('employee.role === "owner" ? requestedShop : employee.shop_id');
    expect(page).toContain('employee.role === "owner" && report.profit');
    expect(chart).toContain('role="tooltip"');
    expect(chart).toContain('data-chart-container="no-scrollbars"');
    expect(chart).toContain("chartPointPosition");
  });

  it("resolves all touched localization labels in both dictionaries", () => {
    const en = JSON.parse(read("../../locales/en.json"));
    const ua = JSON.parse(read("../../locales/ua.json"));
    for (const key of ["title", "period", "apply", "revenue", "itemsSold", "goldWeightSold", "netProfit", "inStock", "inStockGoldWeight", "inventoryValue", "dailyRevenue", "categoryPerformance", "shopPerformance"]) {
      expect(en.dashboard[key]).toBeTruthy();
      expect(ua.dashboard[key]).toBeTruthy();
    }
    expect(en.dashboard.itemsSold).toBe("Items Sold");
    expect(ua.dashboard.itemsSold).toMatch(/Продано/);
  });
});
