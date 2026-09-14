import { describe, expect, it } from "vitest";
import { historicalLocationDisplayName, locationDisplayName } from "./display";

describe("location display names", () => {
  it("localizes the warehouse without changing other stored names", () => {
    const warehouse = { name: "Warehouse", location_type: "WAREHOUSE" };
    expect(locationDisplayName(warehouse, "ua")).toBe("Склад");
    expect(locationDisplayName(warehouse, "en")).toBe("Warehouse");
    expect(locationDisplayName({ name: "Kamin", location_type: "SHOP" }, "ua")).toBe("Kamin");
    expect(historicalLocationDisplayName("Warehouse", "ua")).toBe("Склад");
  });
});
