import {describe,expect,it} from "vitest";
import {kyivCalendarDateBoundaries} from "./created-date";

describe("Inventory Created Date Kyiv boundaries",()=>{
 it("uses the UTC+3 summer calendar day",()=>expect(kyivCalendarDateBoundaries("2026-09-14")).toEqual({start:"2026-09-13T21:00:00.000Z",end:"2026-09-14T21:00:00.000Z"}));
 it("uses the UTC+2 winter calendar day",()=>expect(kyivCalendarDateBoundaries("2026-12-14")).toEqual({start:"2026-12-13T22:00:00.000Z",end:"2026-12-14T22:00:00.000Z"}));
 it("rejects impossible dates",()=>expect(kyivCalendarDateBoundaries("2026-02-30")).toBeNull());
});
