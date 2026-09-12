import {readFileSync} from "node:fs";import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
describe("Task 15 focused UI",()=>{
 it("offers destructive product deletion only through owner-gated detail controls",()=>{const detail=read("../app/(protected)/inventory/[id]/page.tsx");expect(detail).toContain('item.status!=="SOLD"');expect(detail).toContain('label="Delete permanently"');expect(detail).toContain("ConfirmActionButton");});
 it("supports only current-page bulk selection and refreshes after a successful move",()=>{const table=read("./inventory-bulk-table.tsx");expect(table).toContain("Select all on current page");expect(table).toContain("Clear selection");expect(table).toContain("Bulk Actions: Move to Shop");expect(table).toContain("router.refresh()");expect(table).toContain('canManage?<');expect(table).not.toMatch(/all pages|entire inventory/i);});
 it("removes only the list/effective price cart column",()=>{const cart=read("./sales-checkout.tsx");expect(cart).toContain('["Product Details", "Weight", "Status", "Discount %", "Sale Price", ""]');expect(cart).not.toMatch(/List \/ effective price|effectivePriceSourceLabel/);expect(cart).toContain("discountedPrice(item.listPrice, item.discountPercent)");expect(cart).toContain("cartTotal(cart)");});
});
