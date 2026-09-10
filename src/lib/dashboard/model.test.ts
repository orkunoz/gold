import { describe, expect, it } from "vitest";
import { dashboardSections, reportingPeriod } from "./model";

describe("dashboard controls", () => {
  it("defaults invalid periods to this month", () => { expect(reportingPeriod(undefined)).toBe("THIS_MONTH"); expect(reportingPeriod("invalid")).toBe("THIS_MONTH"); expect(reportingPeriod("TODAY")).toBe("TODAY"); });
  it("limits salesperson sections", () => { expect(dashboardSections("salesperson")).toEqual({ inventory: false, comparisons: false, shopPerformance: false }); });
  it("keeps full reporting for owners", () => { expect(dashboardSections("owner")).toMatchObject({ inventory: true, comparisons: true, shopPerformance: true }); });
});
