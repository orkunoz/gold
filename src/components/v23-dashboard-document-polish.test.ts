import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("ZLATA V2.3 dashboard, motion, and document polish", () => {
  it("keeps the approved desktop header order and a focus-only skip link", () => {
    const layout = read("../app/(protected)/layout.tsx");
    const order = ["zl-brand-logo", "<Navigation", "<SellLink", "<LanguageSelector", "<ThemeToggle", "<AccountMenu"];
    for (let index = 1; index < order.length; index += 1) expect(layout.indexOf(order[index])).toBeGreaterThan(layout.indexOf(order[index - 1]));
    expect(layout).toContain('className="zl-skip-link"');
    const css = read("../app/globals.css");
    expect(css).toContain(".zl-skip-link:focus-visible");
    expect(css).toContain("transform:translateY(calc(-100% - 1.5rem))");
  });

  it("uses the approved dashboard composition without the Recent Sales subtitle", () => {
    const dashboard = read("../app/(protected)/dashboard/page.tsx");
    expect(dashboard).toContain("max-w-[1320px]");
    expect(dashboard).toContain("minmax(0,1.85fr)");
    expect(dashboard).toContain("lg:grid-cols-4");
    expect(dashboard).toContain("zl-table--dashboard");
    expect(dashboard).not.toContain('t("dashboard.recentSalesSubtitle")');
  });

  it("fills the chart allocation and uses the responsive two-column location grid", () => {
    const chart = read("./sales-trend.tsx");
    const locations = read("./inventory-distribution-list.tsx");
    expect(chart).toContain("flex h-full min-h-40");
    expect(chart).toContain("min-h-40 w-full min-w-0 flex-1");
    expect(locations).toContain("sm:grid-cols-2");
    expect(locations).toContain("sm:col-span-2");
    expect(locations).not.toContain("of 12");
  });

  it("shares restrained open-close popover motion and portals table tooltips", () => {
    const popover = read("./ui/popover-surface.tsx");
    const css = read("../app/globals.css");
    const tooltip = read("./ui/info-tooltip.tsx");
    expect(read("./account-menu.tsx")).toContain("PopoverSurface");
    expect(read("./account-menu.tsx")).toContain("aria-label={username}");
    expect(read("./dashboard-filters.tsx")).toContain("PopoverSurface");
    expect(popover).toContain('data-state={open ? "open"');
    expect(css).toContain("zl-popover-in .16s ease-out");
    expect(css).toContain("zl-popover-out .14s ease-in");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
    expect(tooltip).toContain("createPortal");
    expect(tooltip).toContain("getBoundingClientRect");
  });

  it("uses 13px document headers, 12px rows, compact locations, and matching print sizes", () => {
    const transfer = read("./transfer-note.tsx");
    const receipt = read("./added-products-note.tsx");
    expect(transfer).toContain("font-size:12px;font-variant-numeric");
    expect(transfer).toContain("font-size:13px;font-weight:700");
    expect(transfer).toContain(".transfer-note__table{font-size:9pt}");
    expect(transfer).toContain(".transfer-note__table th{font-size:9.75pt}");
    expect(transfer).not.toContain("min-height:88px");
    expect(transfer).not.toContain("min-height:20mm");
    expect(transfer).toContain("word-break:break-all");
    expect(receipt).toContain(".added-products-note .transfer-note__table{font-size:12px}");
    expect(receipt).toContain(".added-products-note .transfer-note__table th{font-size:13px}");
  });
});
