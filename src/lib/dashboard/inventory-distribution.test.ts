import { describe, expect, it } from "vitest";
import { inventoryDistribution } from "./inventory-distribution";

const locations = [
  { id: "warehouse", name: "Warehouse", location_type: "WAREHOUSE", is_active: true },
  { id: "shop", name: "Kamin", location_type: "SHOP", is_active: true },
  { id: "inactive", name: "Old shop", location_type: "SHOP", is_active: false },
];

describe("current inventory distribution", () => {
  it("includes Warehouse, excludes inactive locations, and calculates shares from active in-stock counts", () => {
    expect(inventoryDistribution(locations, [
      { shop_id: "warehouse", in_stock_count: 3 },
      { shop_id: "shop", in_stock_count: 1 },
      { shop_id: "inactive", in_stock_count: 100 },
    ])).toMatchObject([
      { id: "warehouse", inStock: 3, totalInStock: 4, percentage: 75 },
      { id: "shop", inStock: 1, totalInStock: 4, percentage: 25 },
    ]);
  });

  it("returns zero percentages when no active location has stock", () => {
    const result = inventoryDistribution(locations, []);
    expect(result.every(location => location.totalInStock === 0 && location.percentage === 0)).toBe(true);
  });
});
