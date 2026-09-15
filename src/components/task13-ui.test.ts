import {readFileSync} from "node:fs";import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
describe("Task 13 operational UI",()=>{
 it("uses a modal for destructive confirmation",()=>{const source=read("./confirm-action-button.tsx");expect(source).toContain("<dialog");expect(source).toContain("{label}");});
 it("removes redundant page copy",()=>{expect(read("../app/(protected)/dashboard/page.tsx")).not.toMatch(/Business overview|Reporting days use/);expect(read("../app/(protected)/inventory/page.tsx")).not.toMatch(/Stock workspace|BarcodeScanner/);expect(read("../app/(protected)/sales/page.tsx")).not.toMatch(/Sales workspace|Scan physical items/);expect(read("../app/(protected)/admin/page.tsx")).not.toMatch(/Owner workspace/);});
 it("keeps the cleaned localized inventory column sequence with Created Date after Barcode",()=>{expect(read("./inventory-bulk-table.tsx")).toContain('["number","productCategory","article","producer","size","weight",...(canManage?["purchasePrice"]:[]),"pricePerGram","priceUah","status","shop","barcode","createdDate"]');});
 it("uses red for sold and gray for removed",()=>{const source=read("./inventory-status.tsx");expect(source).toMatch(/SOLD: "bg-red/);expect(source).toMatch(/REMOVED: "bg-stone/);});
});
