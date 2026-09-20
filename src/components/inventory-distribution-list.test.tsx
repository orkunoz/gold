import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InventoryDistributionList } from "./inventory-distribution-list";

describe("InventoryDistributionList", () => {
  it("renders compact item-count rows without denominator copy and differentiates Warehouse", () => {
    const html = renderToStaticMarkup(<InventoryDistributionList locale="en" locations={[
      { id: "shop", name: "Kamin", location_type: "SHOP", inStock: 3, percentage: 25 },
      { id: "warehouse", name: "Warehouse", location_type: "WAREHOUSE", inStock: 9, percentage: 75 },
    ]} />);
    expect(html).toContain("3 items");
    expect(html).not.toContain("of 12");
    expect(html).toContain('data-inventory-location="warehouse"');
    expect(html).toContain("bg-stone-500/70");
    expect(html.indexOf("Kamin")).toBeLessThan(html.indexOf("Warehouse"));
  });
});
