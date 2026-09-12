import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Task 17 scoped UI", () => {
  it("takes Administration directly to Accounts and Shops without summary stats or data reads", () => {
    const source = read("../app/(protected)/admin/page.tsx");
    expect(source).toContain("Accounts");
    expect(source).toContain("Shops");
    expect(source).not.toMatch(/Active shops|Active accounts|Salespeople|getAdmin/);
  });

  it("keeps the sales chart responsive without scrollbar containers", () => {
    const source = read("./sales-trend.tsx");
    expect(source).toContain('data-chart-container="no-scrollbars"');
    expect(source).toContain("w-full min-w-0 overflow-hidden");
    expect(source).not.toMatch(/overflow-[xy]-auto|min-w-\[640px\]/);
  });

  it("shows tooltip date, physical items sold, and revenue", () => {
    const source = read("./sales-trend.tsx");
    expect(source).toContain("Items Sold:");
    expect(source).toContain("point.items_sold");
    expect(source).toContain("Revenue:");
    expect(source).toContain("onMouseEnter");
    expect(source).toContain("onClick");
    expect(source).toContain("formatDashboardDate");
    expect(source).not.toContain("new Date(");
  });

  it("hides REMOVED in dashboard summary and Inventory filter while retaining the status model", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    const filters = read("./inventory-filters.tsx");
    expect(dashboard).toContain('["IN_STOCK","SOLD"]');
    expect(filters).toContain('["IN_STOCK", "SOLD"]');
    expect(filters).not.toContain("Metal<select");
    expect(read("../lib/inventory/constants.ts")).toContain('"REMOVED"');
  });

  it("offers URL-backed custom start and optional end dates for both roles", () => {
    const source = read("../app/(protected)/dashboard/page.tsx");
    expect(source).toContain('name="start"');
    expect(source).toContain('name="end"');
    expect(source).toContain("customDateRange");
    expect(source).toContain('employee.role === "owner" ? requestedShop : employee.shop_id');
  });
});
