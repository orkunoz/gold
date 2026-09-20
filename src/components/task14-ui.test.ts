import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Task 14 focused UI", () => {
  it("removes fineness and metal from current inventory UI", () => {
    expect(read("./inventory-form.tsx")).not.toContain('fields.fineness');
    expect(read("../app/(protected)/inventory/[id]/page.tsx")).not.toContain('fields.metal');
  });
  it("simplifies administration controls", () => {
    const shops = read("../app/(protected)/admin/shops/page.tsx");
    const accounts = read("../app/(protected)/admin/employees/page.tsx");
    expect(shops).not.toMatch(/setShopActive|Deactivate|Activate/);
    expect(accounts).not.toMatch(/All statuses|All roles|All shops|Edit \/ password/);
    expect(accounts).toContain('t("common.edit")');
  });
  it("does not duplicate identity in checkout or show salesperson shop controls", () => {
    const checkout = read("./sales-checkout.tsx");
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    expect(checkout).not.toMatch(/employee\.username|employee\.full_name/);
    expect(dashboard).toContain('employee.role === "owner" ? getActiveShops()');
    expect(dashboard).not.toContain("Assigned shop");
  });
  it("keeps category performance and shows one compact count per recent sale", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    expect(dashboard).toContain('t("fields.productCategory")');
    expect(dashboard).toContain('t("dashboard.categoryPerformance")');
    expect(dashboard).toContain("sale.item_count");
    expect(dashboard).not.toContain("sale.category_summary");
  });
});
