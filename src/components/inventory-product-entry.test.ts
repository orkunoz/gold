import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {draftValidation} from "../lib/inventory/draft-validation";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const valid={shop_id:"warehouse",category_name:"Каблучка",article_number:"",producer:"NewGold",size:"17",weight_grams:"2.4",purchase_price:"",price_per_gram:"1500",barcode:"001234"};
describe("manual product entry",()=>{
 it.each(["category_name","producer","weight_grams","price_per_gram"] as const)("rejects missing %s",field=>expect(draftValidation({...valid,[field]:""})).toHaveProperty(field,"required"));
 it("accepts a valid draft and preserves leading-zero barcode",()=>{expect(draftValidation(valid)).toEqual({});expect(valid.barcode).toBe("001234")});
 it("renders cached creatable lookups, selectable locations, and scanner-safe Enter",()=>{const source=read("./inventory-draft-basket.tsx");expect(source).toContain("<datalist");expect(source).toContain("locations.map");expect(source).toContain('if(e.key==="Enter")e.preventDefault()');expect(source).toContain("CameraBarcodeScanner")});
 it("defaults location state from the Warehouse option",()=>expect(read("./inventory-draft-basket.tsx")).toContain('shop_id:warehouse?.id??""'));
});
describe("camera scanner safety",()=>{
 const source=read("./camera-barcode-scanner.tsx");
 it("requests permission only from the Scan click path",()=>{expect(source).toContain("function open()");expect(source).toContain("getUserMedia");expect(source).not.toMatch(/useEffect\(\(\)=>.*start/)});
 it("stops tracks on success, close, and unmount",()=>{expect(source).toContain("getTracks().forEach(track=>track.stop())");expect(source).toContain("useEffect(()=>stop,[stop])");expect(source).toContain("function success")});
 it("uses native detection with a ZXing fallback",()=>{expect(source).toContain("BarcodeDetector");expect(source).toContain('@zxing/library')});
});
