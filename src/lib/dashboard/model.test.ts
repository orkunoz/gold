import { describe, expect, it } from "vitest";
import { customDateRange, dashboardSections, reportingPeriod } from "./model";

describe("dashboard controls", () => {
  it("defaults invalid periods to this month", () => { expect(reportingPeriod(undefined)).toBe("THIS_MONTH"); expect(reportingPeriod("invalid")).toBe("THIS_MONTH"); expect(reportingPeriod("TODAY")).toBe("TODAY"); });
  it("limits salesperson sections", () => { expect(dashboardSections("salesperson")).toEqual({ inventory: false, comparisons: false, shopPerformance: false }); });
  it("keeps full reporting for owners", () => { expect(dashboardSections("owner")).toMatchObject({ inventory: true, comparisons: true, shopPerformance: true }); });
  it("accepts a single custom date as an inclusive one-day range", () => { expect(customDateRange("CUSTOM", "2026-09-15", "")).toEqual({ start: "2026-09-15", end: "2026-09-15", error: null }); });
  it("accepts an ordered custom start and end date", () => { expect(customDateRange("CUSTOM", "2026-09-01", "2026-09-15")).toEqual({ start: "2026-09-01", end: "2026-09-15", error: null }); });
  it("rejects reversed and impossible custom ranges", () => { expect(customDateRange("CUSTOM", "2026-09-15", "2026-09-01").error).toMatch(/Start date/); expect(customDateRange("CUSTOM", "2026-02-30", "").error).toMatch(/valid/); });
});
