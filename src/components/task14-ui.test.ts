import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Task 14 focused UI", () => {
  it("shows fineness after metal in inventory form and detail", () => {
    expect(read("./inventory-form.tsx")).toMatch(/Metal[\s\S]*Fineness/);
    expect(read("../app/(protected)/inventory/[id]/page.tsx")).toMatch(/"Metal"[\s\S]*"Fineness"[\s\S]*"Size"/);
  });
  it("simplifies administration controls", () => {
    const shops = read("../app/(protected)/admin/shops/page.tsx");
    const accounts = read("../app/(protected)/admin/employees/page.tsx");
    expect(shops).not.toMatch(/setShopActive|Deactivate|Activate/);
    expect(accounts).not.toMatch(/All statuses|All roles|All shops|Edit \/ password/);
    expect(accounts).toContain(">Edit</Link>");
  });
  it("does not duplicate identity in checkout or show salesperson shop controls", () => {
    const checkout = read("./sales-checkout.tsx");
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    expect(checkout).not.toMatch(/employee\.username|employee\.full_name/);
    expect(dashboard).toContain('employee.role === "owner" ? getActiveShops()');
    expect(dashboard).not.toContain("Assigned shop");
  });
  it("shows category summaries and counts once per recent sale", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    expect(dashboard).toContain("Product Category");
    expect(dashboard).toContain("sale.category_summary");
    expect(dashboard).toContain("sale.item_count");
  });
});
