import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("protected navigation performance guards", () => {
  it("does not query every active shop from the shared layout", () => {
    const source = read("../app/(protected)/layout.tsx");
    expect(source).not.toContain("getActiveShops");
    expect(source).not.toContain("requireUser");
  });

  it("only loads Sales shop options for owners", () => {
    const source = read("../app/(protected)/sales/page.tsx");
    expect(source).toContain('employee.role === "owner" ? await getActiveShops() : []');
  });

  it("keeps internal navigation on Next Link with pending feedback", () => {
    const source = read("./navigation.tsx");
    expect(source).toContain("useLinkStatus");
    expect(source).not.toContain("window.location");
  });

  it("keeps administration reads split by screen", () => {
    expect(read("../app/(protected)/admin/employees/page.tsx")).toContain("getAdminEmployees");
    expect(read("../app/(protected)/admin/shops/page.tsx")).toContain("getAdminShops");
  });

  it("uses request-scoped auth and employee caches", () => {
    expect(read("../lib/auth/session.ts")).toContain("export const getClaims = cache(");
    expect(read("../lib/inventory/queries.ts")).toContain("export const getCurrentEmployee = cache(");
  });

  it("does not download inventory rows just to calculate Administration counts", () => {
    const source = read("../lib/admin/queries.ts");
    expect(source).toContain('rpc("get_admin_shop_counts")');
    expect(source).not.toContain('from("inventory_items").select("shop_id")');
  });

  it("starts the core Inventory read before awaiting role-specific options", () => {
    const source = read("../app/(protected)/inventory/page.tsx");
    expect(source).toContain("const inventoryPromise = getInventoryItems(filters, page)");
    expect(source).toContain('getInventoryOptions(employee.role === "owner")');
  });
});
