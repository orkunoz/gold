import { describe, expect, it } from "vitest";
import { sortSizes, sortUkrainian } from "./option-sorting";

describe("Add Product option sorting", () => {
  it("sorts numeric sizes by value and puts text sizes afterward", () => {
    expect(sortSizes(["XL", "17", "14.5", "14", "15,5", "15", "Дитячий"])).toEqual(["14", "14.5", "15", "15,5", "17", "Дитячий", "XL"]);
  });
  it("sorts labels with Ukrainian collation without mutating input", () => {
    const values = ["Якір", "Ажур", "Браслет", "Ґудзик"];
    expect(sortUkrainian(values)).toEqual(["Ажур", "Браслет", "Ґудзик", "Якір"]);
    expect(values).toEqual(["Якір", "Ажур", "Браслет", "Ґудзик"]);
  });
});
