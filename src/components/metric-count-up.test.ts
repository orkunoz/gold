import { describe, expect, it } from "vitest";
import { METRIC_COUNT_UP_DURATION, metricCountUpFrame, metricMaximumFractionDigits } from "./metric-count-up";

describe("metric count-up", () => {
  it("animates raw Weight Sold 25 from zero without scaling the target", () => {
    expect(metricCountUpFrame(25, 0)).toBe(0);
    for (const elapsed of [1, 100, 325, 649]) {
      expect(metricCountUpFrame(25, elapsed)).toBeGreaterThanOrEqual(0);
      expect(metricCountUpFrame(25, elapsed)).toBeLessThan(25);
    }
    expect(metricCountUpFrame(25, METRIC_COUNT_UP_DURATION)).toBe(25);
    expect(metricMaximumFractionDigits("weight", 25)).toBe(0);
    expect(new Intl.NumberFormat("uk-UA", { maximumFractionDigits: metricMaximumFractionDigits("weight", 25) }).format(metricCountUpFrame(25, 649))).not.toContain(",");
  });

  it("uses the same fixed duration for small and large values and returns exact finals", () => {
    expect(METRIC_COUNT_UP_DURATION).toBe(650);
    expect(metricCountUpFrame(2, 325)).toBeCloseTo(1.75);
    expect(metricCountUpFrame(19_800, 325)).toBeCloseTo(17_325);
    expect(metricCountUpFrame(2, 650)).toBe(2);
    expect(metricCountUpFrame(19_800, 650)).toBe(19_800);
  });

  it("keeps zero exact and skips interpolation for reduced motion", () => {
    expect(metricCountUpFrame(0, 0)).toBe(0);
    expect(metricCountUpFrame(18_700, 0, true)).toBe(18_700);
  });
});
