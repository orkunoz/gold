import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {describe,expect,it,vi} from "vitest";
import {paginate,Pagination,requestPageChange} from "./pagination";
import {pageHref} from "./url-pagination";

describe("shared pagination",()=>{
 it("is the same URL control on Inventory and Sales with 25-row queries",()=>{
  const inventory=readFileSync(new URL("../../app/(protected)/inventory/page.tsx",import.meta.url),"utf8");
  const sales=readFileSync(new URL("../../app/(protected)/sales/page.tsx",import.meta.url),"utf8");
  const salesQuery=readFileSync(new URL("../../lib/sales/queries.ts",import.meta.url),"utf8");
  expect(inventory).toContain("<UrlPagination page={page} count={totalPages}");
  expect(sales).toContain("<UrlPagination page={page} count={pages}");
  expect(inventory).toContain("getInventoryItems(filters, page, 25, sort, direction)");
  expect(salesQuery).toContain("pageSize = 25");
 });
 it.each([1,2,7,9,12,50,137])("produces valid, unique pages for %i pages",count=>{
  for(const page of [1,2,Math.floor(count/2),count-1,count]){
   const items=paginate(page,count),numbers=items.filter((item):item is number=>typeof item==="number");
   expect(numbers).toEqual([...new Set(numbers)]);
   expect(numbers.every(number=>number>=1&&number<=count)).toBe(true);
   expect(numbers[0]).toBe(1);
   expect(numbers.at(-1)).toBe(count);
   expect(items.length).toBeLessThanOrEqual(9);
   expect(items.filter(item=>item==="gap-l").length).toBeLessThanOrEqual(1);
   expect(items.filter(item=>item==="gap-r").length).toBeLessThanOrEqual(1);
   expect(items.join(",")).not.toMatch(/gap-[lr],gap-[lr]/);
  }
 });
 it("keeps a compact five-page center with first, last and one gap on each side",()=>{
  expect(paginate(25,50)).toEqual([1,"gap-l",23,24,25,26,27,"gap-r",50]);
  expect(paginate(1,50)).toEqual([1,2,3,4,5,6,7,"gap-r",50]);
  expect(paginate(50,50)).toEqual([1,"gap-l",44,45,46,47,48,49,50]);
  expect(paginate(12,12)).toEqual([1,"gap-l",6,7,8,9,10,11,12]);
  expect(paginate(0,0)).toEqual([1]);
  expect(paginate(900,50)).toEqual(paginate(50,50));
 });
 it("renders current state, labelled controls and disabled boundaries",()=>{
  const html=renderToStaticMarkup(<Pagination count={2} page={1} onPageChange={()=>{}} label="Inventory pages" previousLabel="Previous" nextLabel="Next" pageLabel={String}/>);
  expect(html).toContain('aria-current="page"');
  expect(html).toContain('aria-label="Previous" disabled');
  expect(html).toContain("enabled:hover:bg-stone-100 enabled:hover:text-stone-800");
  expect(html).not.toContain("disabled:hover:");
  expect(html).toContain('aria-label="Next"');
  expect(html).toContain('aria-label="Inventory pages"');
  const lastPage=renderToStaticMarkup(<Pagination count={2} page={2} onPageChange={()=>{}} label="Inventory pages" previousLabel="Previous" nextLabel="Next" pageLabel={String}/>);
  expect(lastPage).toContain('aria-label="Next" disabled');
 });
 it("guards previous and next callbacks at their disabled boundaries",()=>{
  const onPageChange=vi.fn();
  requestPageChange(1,10,0,onPageChange);
  requestPageChange(10,10,11,onPageChange);
  expect(onPageChange).not.toHaveBeenCalled();
  requestPageChange(4,10,5,onPageChange);
  expect(onPageChange).toHaveBeenCalledExactlyOnceWith(5);
 });
 it("changes only page while preserving Inventory and Sales query parameters",()=>{
  expect(pageHref("/inventory","producer=Maker&size=17&weight=2.5&status=SOLD&sort=priceUah&direction=asc&page=1",3)).toBe("/inventory?producer=Maker&size=17&weight=2.5&status=SOLD&sort=priceUah&direction=asc&page=3");
  expect(pageHref("/sales","period=CUSTOM&shop=shop-1&start=2026-09-01&end=2026-09-22&page=3",1)).toBe("/sales?period=CUSTOM&shop=shop-1&start=2026-09-01&end=2026-09-22");
  const urlPagination=readFileSync(new URL("./url-pagination.tsx",import.meta.url),"utf8");
  const inventoryFilters=readFileSync(new URL("../inventory-filters.tsx",import.meta.url),"utf8");
  expect(urlPagination).toContain("{scroll:false}");
  expect(urlPagination).toContain("scrollToTopForPagination()");
  expect(urlPagination).not.toContain("{scroll:true}");
  expect(inventoryFilters).toContain("{ scroll: false }");
 });
 it("overrides the global waiting cursor for disabled paginator arrows",()=>{
  const css=readFileSync(new URL("../../app/globals.css",import.meta.url),"utf8");
  expect(css).toContain("button:disabled { cursor: wait; }");
  expect(css).toContain("button.zl-pagination-arrow:disabled { cursor: default; }");
  const html=renderToStaticMarkup(<Pagination count={1} page={1} onPageChange={()=>{}} label="Pages" previousLabel="Previous" nextLabel="Next" pageLabel={String}/>);
  expect(html.match(/class="zl-pagination-arrow/g)).toHaveLength(2);
  expect(html.match(/disabled=""/g)).toHaveLength(2);
 });
});
