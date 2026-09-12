import { describe, expect, it } from "vitest";
import { chartPointPosition } from "./sales-trend";

const points = (dates: string[]) => dates.map((date) => ({ date, revenue: 0, items_sold: 0 }));

describe("sales trend date positioning", () => {
  it("centers a narrow bar for a one-day range", () => {
    expect(chartPointPosition(points(["2026-09-12"]), 0)).toBe(50);
  });

  it.each([
    ["7-day", ["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"]],
    ["30-day", Array.from({ length: 30 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`)],
  ])("anchors the first and last bars for a %s range", (_name, dates) => {
    const range = points(dates);
    expect(chartPointPosition(range, 0)).toBe(0);
    expect(chartPointPosition(range, range.length - 1)).toBe(100);
  });

  it("positions custom-range dates in proportion to elapsed calendar days", () => {
    const range = points(["2026-09-01", "2026-09-03", "2026-09-11"]);
    expect(chartPointPosition(range, 0)).toBe(0);
    expect(chartPointPosition(range, 1)).toBe(20);
    expect(chartPointPosition(range, 2)).toBe(100);
  });
});
