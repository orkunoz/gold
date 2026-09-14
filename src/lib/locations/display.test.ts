import { describe, expect, it } from "vitest";
import { historicalLocationDisplayName, locationDisplayName } from "./display";

describe("location display names", () => {
  it("localizes known locations without changing English or unknown names", () => {
    const warehouse = { name: "Warehouse", location_type: "WAREHOUSE" };
    expect(locationDisplayName(warehouse, "ua")).toBe("Склад");
    expect(locationDisplayName(warehouse, "en")).toBe("Warehouse");
    expect(locationDisplayName({ name: "Kamin", location_type: "SHOP" }, "ua")).toBe("Камінь");
    expect(locationDisplayName({ name: "Horokhiv", location_type: "SHOP" }, "ua")).toBe("Горохів");
    expect(locationDisplayName({ name: "Novovolynsk", location_type: "SHOP" }, "ua")).toBe("Нововолинськ");
    expect(locationDisplayName({ name: "Volodymyr", location_type: "SHOP" }, "ua")).toBe("Володимир");
    expect(locationDisplayName({ name: "Kamin", location_type: "SHOP" }, "en")).toBe("Kamin");
    expect(locationDisplayName({ name: "Custom", location_type: "SHOP" }, "ua")).toBe("Custom");
    expect(historicalLocationDisplayName("Warehouse", "ua")).toBe("Склад");
    expect(historicalLocationDisplayName("Volodymyr", "ua")).toBe("Володимир");
  });
});
