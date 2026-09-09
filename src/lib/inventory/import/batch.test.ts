import { describe, expect, it } from "vitest";
import { batchImportRows } from "./batch";

describe("inventory import batching", () => {
  it("splits a large import without dropping or repeating rows", () => {
    const rows = Array.from({ length: 251 }, (_, index) => index);
    const batches = batchImportRows(rows, 100);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 51]);
    expect(batches.flat()).toEqual(rows);
  });
});
