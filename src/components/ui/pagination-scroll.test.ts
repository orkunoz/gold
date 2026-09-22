import {afterEach,describe,expect,it,vi} from "vitest";
import {PAGINATION_SCROLL_DURATION_MS,scrollToTopForPagination} from "./pagination-scroll";

afterEach(()=>vi.unstubAllGlobals());

describe("pagination scroll",()=>{
 it("smoothly reaches the top in 450 ms without delaying navigation",()=>{
  const frames:Array<(time:number)=>void>=[];
  const scrollTo=vi.fn();
  vi.stubGlobal("window",{scrollY:800,scrollTo,performance:{now:()=>100},matchMedia:()=>({matches:false}),requestAnimationFrame:(frame:(time:number)=>void)=>{frames.push(frame);return frames.length},cancelAnimationFrame:vi.fn()});
  scrollToTopForPagination();
  expect(PAGINATION_SCROLL_DURATION_MS).toBe(450);
  expect(scrollTo).not.toHaveBeenCalled();
  frames.shift()?.(325);
  expect(scrollTo).toHaveBeenCalledWith(0,100);
  frames.shift()?.(550);
  expect(scrollTo).toHaveBeenLastCalledWith(0,0);
 });
 it("jumps immediately for reduced-motion users",()=>{
  const scrollTo=vi.fn(),requestAnimationFrame=vi.fn();
  vi.stubGlobal("window",{scrollY:800,scrollTo,performance:{now:()=>100},matchMedia:()=>({matches:true}),requestAnimationFrame,cancelAnimationFrame:vi.fn()});
  scrollToTopForPagination();
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0,0);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
 });
});
