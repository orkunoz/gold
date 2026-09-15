import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
describe("inventory workspace width",()=>{
 it("uses the full workspace for Import Inventory",()=>expect(read("../app/(protected)/inventory/import/page.tsx")).toContain('className="w-full"'));
 it("uses the full workspace for Product Detail",()=>expect(read("../app/(protected)/inventory/[id]/page.tsx")).toContain('className="w-full"'));
});
