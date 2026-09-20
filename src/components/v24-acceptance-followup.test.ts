import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("ZLATA V2.4 production acceptance follow-up",()=>{
  it("filters barcode and article lookup to IN_STOCK while preserving the locked server safeguard",()=>{
    const lookup=read("../app/api/sales/lookup/route.ts");
    expect(lookup.match(/\.eq\("status",\s*"IN_STOCK"\)/g)).toHaveLength(2);
    expect(lookup).toContain('select(selection,{count:"exact"})');
    const completion=read("../../supabase/migrations/20260913120000_unlimited_sale_notes.sql");
    expect(completion).toContain("order by item.id for update of item");
    expect(completion).toContain("if inventory.status <> 'IN_STOCK'");
  });

  it("caps the filtered dashboard result in presentation and keeps View All plus a noninteractive conditional fade",()=>{
    const dashboard=read("../app/(protected)/dashboard/page.tsx"),css=read("../app/globals.css");
    expect(dashboard).toContain("recentSalesWindow(report.recent_sales)");
    expect(dashboard).toContain('href="/sales"');
    expect(dashboard).toContain('recentSales.hasMore ? "zl-recent-sales--continued"');
    expect(dashboard).toContain("getDashboardReport(reportPeriod, shopId, range.start, range.end, employee.role)");
    expect(css).toContain(".zl-recent-sales--continued::after");
    expect(css).toContain("pointer-events:none");
  });
});
