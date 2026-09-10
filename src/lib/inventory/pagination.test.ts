import { describe, expect, it } from "vitest";
import { inventoryOrdinal, inventoryResultSummary } from "./pagination";

describe("inventory filtered result numbering", () => {
  it("starts filtered results at one", () => expect(inventoryOrdinal(1, 50, 0)).toBe(1));
  it("continues numbering across pages", () => expect(inventoryOrdinal(2, 50, 0)).toBe(51));
  it("uses the database total rather than loaded rows", () => expect(inventoryResultSummary(2, 50, 137, 50)).toBe("Showing 51–100 of 137 products"));
  it("handles empty filtered results", () => expect(inventoryResultSummary(1, 50, 0, 0)).toBe("0 products"));
});
