import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Task 17 scoped UI", () => {
  it("takes Administration directly to Accounts and Shops without summary stats or data reads", () => {
    const source = read("../app/(protected)/admin/page.tsx");
    expect(source).toContain('t("admin.accounts")');
    expect(source).toContain('t("admin.shops")');
    expect(source).not.toMatch(/Active shops|Active accounts|Salespeople|getAdmin/);
  });

  it("keeps the sales chart responsive without scrollbar containers", () => {
    const source = read("./sales-trend.tsx");
    expect(source).toContain('data-chart-container="bounded-tooltips"');
    expect(source).toContain("w-full min-w-0 overflow-visible");
    expect(source).toContain("position < 15");
    expect(source).toContain("position > 85");
    expect(source).not.toMatch(/overflow-[xy]-auto|min-w-\[640px\]/);
  });

  it("shows a floating tooltip with date, physical items sold, and revenue", () => {
    const source = read("./sales-trend.tsx");
    expect(source).toContain('role="tooltip"');
    expect(source).toContain('t("dashboard.itemsSold")');
    expect(source).toContain("point.items_sold");
    expect(source).toContain('t("dashboard.revenue")');
    expect(source).toContain("onMouseEnter");
    expect(source).toContain("onMouseLeave={() => setActiveIndex(null)}");
    expect(source).toContain("onBlur={() => setActiveIndex(null)}");
    expect(source).toContain("onClick");
    expect(source).toContain("formatDashboardDate");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain('role="status"');
    expect(source).not.toContain("mb-4 min-h-16");
  });

  it("removes the dashboard status summary while retaining the status model", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    const filters = read("./inventory-filters.tsx");
    expect(dashboard).not.toMatch(/Status summary|status_counts/);
    expect(filters).toContain('["IN_STOCK", "SOLD"]');
    expect(filters).not.toContain("Metal<select");
    expect(read("../lib/inventory/constants.ts")).toContain('"REMOVED"');
  });

  it("uses one URL-backed custom range calendar", () => {
    const source = read("./dashboard-filters.tsx");
    expect(source).toContain('period === "CUSTOM"');
    expect(source).toContain("DateRangeCalendar");
    expect(source).toContain('navigate("CUSTOM"');
    expect(source).not.toContain('type="date"');
    expect(source).toContain('name="shop"');
    const page = read("../app/(protected)/dashboard/page.tsx");
    expect(page).toContain("customDateRange");
    expect(page).toContain('employee.role === "owner" ? requestedShop : employee.shop_id');
  });

  it("keeps the inventory metric without its redundant label and uses the cleaned-up recent-sales labels", () => {
    const source = read("../app/(protected)/dashboard/page.tsx");
    expect(source).toContain("inventory.customer_value");
    expect(source).not.toContain('t("dashboard.inventoryValue")');
    expect(source).toContain('t("sales.saleId"),t("fields.shop"),t("dashboard.itemsSold"),t("common.total")');
    expect(source).not.toContain('t("sales.viewDetails")');
    expect(source).not.toMatch(/label="Total value"|Revenue \/ Total|Status summary/);
  });
});
