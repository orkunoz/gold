import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Owner bulk Purchase Price", () => {
  it("keeps the action inside the existing Owner-only selection controls", () => {
    const table = read("./inventory-bulk-table.tsx");
    expect(table).toContain('t("inventory.changePurchasePrice")');
    expect(table).toContain('onClick={()=>open("purchasePrice")}');
    expect(table.indexOf('t("inventory.changePurchasePrice")')).toBeGreaterThan(table.indexOf("{canManage?<"));
    expect(table).toContain('t("inventory.changeGramPrice")');
    expect(table).toContain('t("inventory.moveSelected")');
    expect(table).toContain('t("inventory.deletePermanently")');
  });

  it("uses a dedicated action, monetary input, localized copy, and refresh convention", () => {
    const table = read("./inventory-bulk-table.tsx");
    expect(table).toContain("bulkChangePurchasePrice(selected,purchasePrice)");
    expect(table).toContain('t("fields.purchasePrice")');
    expect(table).toContain('max={MAX_PURCHASE_PRICE} step="0.01"');
    expect(table).toContain('t("inventory.bulk.apply")');
    expect(table).toContain("setSelected([])");
    expect(table).toContain("router.refresh()");
  });

  it("enforces Owner authorization and delegates atomic mutation to the dedicated RPC", () => {
    const actions = read("../lib/inventory/actions.ts");
    expect(actions).toContain('bulkContext("bulk_purchase_price_change")');
    expect(actions).toContain("canManageInventory(employee.role)");
    expect(actions).toContain('db.rpc("bulk_change_purchase_price"');
  });

  it("does not add Purchase Price to sales or rendered document paths", () => {
    const lookup = read("../app/api/sales/lookup/route.ts");
    const receipt = read("./added-products-note.tsx");
    const transfer = read("./transfer-note.tsx");
    expect(lookup).not.toContain("purchase_price");
    expect(receipt).not.toContain("purchase_price");
    expect(transfer).not.toContain("purchase_price");
  });
});
