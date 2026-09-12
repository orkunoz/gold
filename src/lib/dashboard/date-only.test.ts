import { describe, expect, it } from "vitest";
import { formatDashboardDate, parseDashboardDate } from "./date-only";

describe("dashboard date-only formatting", () => {
  it.each([
    "2026-09-12",
    "2026-09-12T00:00:00",
    "2026-09-12T00:00:00+00:00",
    "2026-09-12T00:00:00.000Z",
  ])("formats the database day %s without a timezone shift", (value) => {
    expect(formatDashboardDate(value, { day: "numeric", month: "short", year: "numeric" })).toBe("12 Sept 2026");
  });

  it.each([undefined, null, "", "not-a-date", "2026-02-30"])("never throws RangeError for invalid value %s", (value) => {
    expect(() => formatDashboardDate(value, { day: "numeric", month: "short" })).not.toThrow();
    expect(formatDashboardDate(value, { day: "numeric", month: "short" })).toBe("Date unavailable");
    expect(parseDashboardDate(value)).toBeNull();
  });

  it("keeps the same calendar day across Kyiv daylight-saving seasons", () => {
    expect(formatDashboardDate("2026-01-15", { day: "numeric", month: "short" })).toBe("15 Jan");
    expect(formatDashboardDate("2026-07-15", { day: "numeric", month: "short" })).toBe("15 Jul");
  });
});
