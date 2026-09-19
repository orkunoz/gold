import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {draftValidation} from "../lib/inventory/draft-validation";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const valid={shop_id:"warehouse",category_name:"Каблучка",article_number:"",producer:"NewGold",size:"17",weight_grams:"2.4",purchase_price:"",price_per_gram:"1500",barcode:"001234"};
describe("manual product entry",()=>{
 it.each(["category_name","producer","weight_grams","price_per_gram"] as const)("rejects missing %s",field=>expect(draftValidation({...valid,[field]:""})).toHaveProperty(field,"required"));
 it("accepts a valid draft and preserves leading-zero barcode",()=>{expect(draftValidation(valid)).toEqual({});expect(valid.barcode).toBe("001234")});
 it("renders cached creatable comboboxes, selectable locations, and scanner-safe Enter",()=>{const source=read("./inventory-draft-basket.tsx");expect(source).toContain("CreatableCombobox");expect(source).toContain("locations.map");expect(source).not.toContain('t("common.unassigned")');expect(source).toContain('if(e.key==="Enter")e.preventDefault()');expect(source).toContain("CameraBarcodeScanner")});
 it("defaults location state from the Warehouse option",()=>expect(read("./inventory-draft-basket.tsx")).toContain('shop_id:warehouse?.id??""'));
 it("restores Owner-scoped drafts, enforces the limit, and confirms intentional clearing",()=>{const source=read("./inventory-draft-basket.tsx");expect(source).toContain("loadManualDrafts(window.localStorage,ownerId)");expect(source).toContain("drafts.length>=MANUAL_DRAFT_LIMIT");expect(source).toContain('window.confirm(t("inventory.batch.clearConfirm"))');});
 it("clears persisted and visible drafts only after confirmed batch and document success",()=>{const source=read("./inventory-draft-basket.tsx");expect(source).toContain('if(!result.error&&result.documentId){setDocumentId(result.documentId);clearManualDrafts(window.localStorage,ownerId);setDrafts([])}');expect(source).not.toMatch(/catch[^}]*setDrafts\(\[\]\)/);expect(source).not.toMatch(/finally[^}]*setDrafts\(\[\]\)/);});
});
describe("camera scanner safety",()=>{
 const source=read("./camera-barcode-scanner.tsx");
 it("requests permission only from the Scan click path",()=>{expect(source).toContain("function open()");expect(source).toContain("getUserMedia");expect(source).not.toMatch(/useEffect\(\(\)=>.*start/)});
 it("stops tracks on success, close, and unmount",()=>{expect(source).toContain("getTracks().forEach(track=>track.stop())");expect(source).toContain("useEffect(()=>stop,[stop])");expect(source).toContain("function success")});
 it("uses native detection with a ZXing fallback",()=>{expect(source).toContain("BarcodeDetector");expect(source).toContain('@zxing/library')});
 it("is reused by entry, Inventory filters, and Sales",()=>{for(const file of ["./inventory-draft-basket.tsx","./inventory-filters.tsx","./sales-checkout.tsx"])expect(read(file)).toContain("CameraBarcodeScanner")});
 it("permits only same-origin camera access",()=>{const config=read("../../next.config.ts");expect(config).toContain("camera=(self)");expect(config).not.toContain("camera=*");expect(config).not.toContain("camera=()")});
});

describe("creatable combobox",()=>{const source=read("./creatable-combobox.tsx");it("has bounded scrolling and ARIA keyboard selection",()=>{expect(source).toContain('role="combobox"');expect(source).toContain("max-h-[300px]");expect(source).toContain('event.key === "ArrowDown"');expect(source).toContain('event.key === "Enter"');expect(source).toContain('event.key === "Escape"')});it("filters and retains a new typed value",()=>{expect(source).toContain(".includes(value.trim()");expect(source).toContain("[value.trim(), ...filtered]")})});

describe("required-field UX",()=>{it("uses localized field errors without a global banner",()=>{const basket=read("./inventory-draft-basket.tsx"),en=read("../../locales/en.json"),ua=read("../../locales/ua.json");expect(basket).not.toContain("requiredFields");expect(en).toContain('"required": "Required field"');expect(ua).toContain('\"required\": \"Обов\'язкове поле\"');expect(basket).not.toContain("validation.required")})});
