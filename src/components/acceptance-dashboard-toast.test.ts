import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { netProfitTone } from "@/lib/dashboard/presentation";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("dashboard and bulk feedback acceptance fixes", () => {
  it("colors Net Profit by sign without changing its calculation", () => {
    expect(netProfitTone(1)).toBe("zl-success");
    expect(netProfitTone(-1)).toBe("zl-danger");
    expect(netProfitTone(0)).toBe("text-stone-950");
    const page = read("../app/(protected)/dashboard/page.tsx");
    expect(page).toContain("value={report.profit.net_profit}");
    expect(page.match(/financialMetricClass/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("uses a five-second accessible fading toast whose version resets its timers", () => {
    const toast = read("./inventory-success-toast.tsx");
    const table = read("./inventory-bulk-table.tsx");
    expect(toast).toContain("INVENTORY_TOAST_VISIBLE_MS = 5000");
    expect(toast).toContain("INVENTORY_TOAST_FADE_MS = 300");
    expect(toast).toContain('role="status"');
    expect(toast).toContain("motion-reduce:transition-none");
    expect(toast).toContain("opacity-0");
    expect(toast).toContain("window.clearTimeout");
    expect(toast).toContain("[message, version, onDismiss]");
    expect(table).toContain("successVersion:current.successVersion+1");
  });

  it("loads salesperson inventory only from the assigned shop with no warehouse or cost fields", () => {
    const page = read("../app/(protected)/dashboard/page.tsx");
    const queries = read("../lib/dashboard/queries.ts");
    expect(page).toContain("getSalespersonInventorySummary(employee.shop_id)");
    expect(queries).toContain('.eq("shop_id", shopId).eq("status", "IN_STOCK")');
    expect(queries).toContain("getEffectivePrices");
    expect(queries).not.toContain("purchase_price");
    expect(page).toContain('employee.role === "owner" && distribution.length');
  });

  it("strengthens the theme-variable Recent Sales fade without blocking interaction", () => {
    const css = read("../app/globals.css");
    expect(css).toContain("height:2rem");
    expect(css).toContain("var(--zl-surface) 92%");
    expect(css).toContain("pointer-events:none");
  });
});
