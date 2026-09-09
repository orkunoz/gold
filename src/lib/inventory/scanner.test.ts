import { describe, expect, it, vi } from "vitest";
import { applyExactBarcodeMatch, normalizeScannedBarcode, scanAnotherHref, scannerSubmissionValue, scanStatusWarning } from "./scanner";

describe("barcode scanner workflow", () => {
  it("trims surrounding whitespace while preserving barcode case", () => {
    expect(normalizeScannedBarcode("  AbC-123\n")).toBe("AbC-123");
  });

  it("uses an exact database match instead of a partial pattern", () => {
    const eq = vi.fn(() => "matched");
    expect(applyExactBarcodeMatch({ eq }, " 123456789 ")).toBe("matched");
    expect(eq).toHaveBeenCalledWith("barcode", "123456789");
    expect(eq).not.toHaveBeenCalledWith("barcode", expect.stringContaining("%"));
  });

  it("ignores an empty scanner submission", () => {
    expect(scannerSubmissionValue("  \n")).toBeNull();
  });

  it("provides prominent warnings only for sold and removed items", () => {
    expect(scanStatusWarning("SOLD")).toBe("This item is already sold.");
    expect(scanStatusWarning("REMOVED")).toBe("This item has been removed from inventory.");
    expect(scanStatusWarning("IN_STOCK")).toBeNull();
    expect(scanStatusWarning("RESERVED")).toBeNull();
  });

  it("returns to the scanner-focused inventory state for repeated scans", () => {
    expect(scanAnotherHref()).toBe("/inventory?scan=1");
  });
});
