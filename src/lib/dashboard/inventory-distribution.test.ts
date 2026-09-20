import { describe, expect, it } from "vitest";
import { inventoryDistribution } from "./inventory-distribution";

const locations = [
  { id: "warehouse", name: "Warehouse", location_type: "WAREHOUSE", is_active: true },
  { id: "kamin", name: "Kamin", location_type: "SHOP", is_active: true },
  { id: "volodymyr", name: "Volodymyr", location_type: "SHOP", is_active: true },
  { id: "horokhiv", name: "Horokhiv", location_type: "SHOP", is_active: true },
  { id: "novovolynsk", name: "Novovolynsk", location_type: "SHOP", is_active: true },
  { id: "inactive", name: "Old shop", location_type: "SHOP", is_active: false },
];

describe("current inventory distribution", () => {
  it("includes Warehouse, excludes inactive locations, and calculates shares from active in-stock counts", () => {
    expect(inventoryDistribution(locations, [
      { shop_id: "warehouse", in_stock_count: 3 },
      { shop_id: "kamin", in_stock_count: 1 },
      { shop_id: "inactive", in_stock_count: 100 },
    ])).toMatchObject([
      { id: "kamin", inStock: 1, totalInStock: 4, percentage: 25 },
      { id: "horokhiv", inStock: 0, totalInStock: 4, percentage: 0 },
      { id: "novovolynsk", inStock: 0, totalInStock: 4, percentage: 0 },
      { id: "volodymyr", inStock: 0, totalInStock: 4, percentage: 0 },
      { id: "warehouse", inStock: 3, totalInStock: 4, percentage: 75 },
    ]);
  });

  it("sorts selling locations by stock, breaks ties by localized name, and always places Warehouse last", () => {
    const result = inventoryDistribution(locations, [
      { shop_id: "warehouse", in_stock_count: 36 },
      { shop_id: "kamin", in_stock_count: 3 },
      { shop_id: "volodymyr", in_stock_count: 5 },
      { shop_id: "horokhiv", in_stock_count: 5 },
      { shop_id: "novovolynsk", in_stock_count: 10 },
    ], "en");
    expect(result.map(location => location.id)).toEqual(["novovolynsk", "horokhiv", "volodymyr", "kamin", "warehouse"]);
    expect(result.map(location => location.inStock)).toEqual([10, 5, 5, 3, 36]);
  });

  it("returns zero percentages when no active location has stock", () => {
    const result = inventoryDistribution(locations, []);
    expect(result.every(location => location.totalInStock === 0 && location.percentage === 0)).toBe(true);
  });
});
