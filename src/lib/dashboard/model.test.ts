import { describe, expect, it } from "vitest";
import { dashboardSections, reportingPeriod } from "./model";

describe("dashboard controls", () => {
  it("defaults invalid periods to this month", () => { expect(reportingPeriod(undefined)).toBe("THIS_MONTH"); expect(reportingPeriod("invalid")).toBe("THIS_MONTH"); expect(reportingPeriod("TODAY")).toBe("TODAY"); });
  it("limits salesperson sections", () => { expect(dashboardSections("salesperson")).toEqual({ inventory: false, comparisons: false, shopPerformance: false }); });
  it("allows owner and manager reporting without cross-role UI leakage", () => { expect(dashboardSections("owner").shopPerformance).toBe(true); expect(dashboardSections("manager")).toMatchObject({ inventory: true, comparisons: true, shopPerformance: false }); });
});
