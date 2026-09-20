import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("ZLATA UI V2 phase 1", () => {
  it("separates Sell checkout from completed Sales history", () => {
    const navigation = read("./navigation.tsx");
    const sell = read("../app/(protected)/sell/page.tsx");
    const sales = read("../app/(protected)/sales/page.tsx");
    expect(navigation).toContain('href="/sell"');
    expect(navigation).toContain('{ href: "/sales", key: "nav.sales" }');
    expect(sell).toContain("SalesCheckout");
    expect(sales).toContain("getSalesHistory");
    expect(sales).toContain('href={`/sales/${sale.id}`}');
  });

  it("keeps role-aware navigation and account controls", () => {
    const navigation = read("./navigation.tsx");
    const layout = read("../app/(protected)/layout.tsx");
    const account = read("./account-menu.tsx");
    expect(navigation).toContain('role === "owner"');
    expect(layout).toContain("employee.username");
    expect(account).toContain("SignOutButton");
    expect(account).toContain('role="menu"');
  });

  it("defaults to light, persists an explicit theme, and never reads OS theme", () => {
    const layout = read("../app/layout.tsx");
    const toggle = read("./theme-toggle.tsx");
    expect(layout).toContain('data-theme="light"');
    expect(layout).toContain("localStorage.getItem('zlata-theme')");
    expect(toggle).toContain('localStorage.setItem("zlata-theme", next)');
    expect(layout + toggle).not.toContain("prefers-color-scheme");
  });

  it("keeps reporting authorization and Warehouse exclusion in PostgreSQL", () => {
    const migration = read("../../supabase/migrations/20260920120000_ui_v2_reporting.sql");
    expect(migration).toContain("p_shop_id<>e.shop_id");
    expect(migration).toContain("location_type='SHOP'");
    expect(migration).toContain("includes Warehouse");
    expect(migration).toContain("purchase_price_snapshot");
    expect(migration).not.toContain("purchase_price_snapshot'\,");
  });
});
