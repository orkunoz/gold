import { describe, expect, it } from "vitest";
import { customDateRange, dashboardSections, recentSalesWindow, reportingBoundaries, reportingPeriod } from "./model";

describe("dashboard controls", () => {
  it("defaults invalid periods to this month", () => { expect(reportingPeriod(undefined)).toBe("THIS_MONTH"); expect(reportingPeriod("invalid")).toBe("THIS_MONTH"); expect(reportingPeriod("TODAY")).toBe("TODAY"); });
  it("limits salesperson sections", () => { expect(dashboardSections("salesperson")).toEqual({ inventory: false, comparisons: false, shopPerformance: false }); });
  it("keeps full reporting for owners", () => { expect(dashboardSections("owner")).toMatchObject({ inventory: true, comparisons: true, shopPerformance: true }); });
  it("accepts a single custom date as an inclusive one-day range", () => { expect(customDateRange("CUSTOM", "2026-09-15", "")).toEqual({ start: "2026-09-15", end: "2026-09-15", error: null }); });
  it("accepts an ordered custom start and end date", () => { expect(customDateRange("CUSTOM", "2026-09-01", "2026-09-15")).toEqual({ start: "2026-09-01", end: "2026-09-15", error: null }); });
  it("rejects reversed and impossible custom ranges", () => { expect(customDateRange("CUSTOM", "2026-09-15", "2026-09-01").error).toMatch(/Start date/); expect(customDateRange("CUSTOM", "2026-02-30", "").error).toMatch(/valid/); });
  it("supports the V2 last-month and all-time presets", () => { expect(reportingPeriod("LAST_MONTH")).toBe("LAST_MONTH"); expect(reportingPeriod("ALL_TIME")).toBe("ALL_TIME"); expect(reportingBoundaries("ALL_TIME")).toEqual({ start: null, end: null }); });
  it("uses inclusive Kyiv calendar dates with an exclusive next-day end", () => { expect(reportingBoundaries("LAST_MONTH", undefined, undefined, new Date("2026-09-20T12:00:00Z"))).toEqual({ start: "2026-07-31T21:00:00.000Z", end: "2026-08-31T21:00:00.000Z" }); });
  it("caps Recent Sales at five and reports continuation only for additional matches",()=>{
    expect(recentSalesWindow([1,2,3,4])).toEqual({sales:[1,2,3,4],hasMore:false});
    expect(recentSalesWindow([1,2,3,4,5])).toEqual({sales:[1,2,3,4,5],hasMore:false});
    expect(recentSalesWindow([1,2,3,4,5,6])).toEqual({sales:[1,2,3,4,5],hasMore:true});
  });
});
