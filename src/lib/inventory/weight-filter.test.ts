import {describe,expect,it} from "vitest";
import {positiveInventoryWeight} from "./weight-filter";

describe("exact inventory weight filter",()=>{
 it.each([["2.5",2.5],[".125",.125],[" 12 ",12]])("accepts %s as %s grams",(value,expected)=>expect(positiveInventoryWeight(String(value))).toBe(expected));
 it.each(["", "0", "-1", "2,5", "2g", "Infinity", "1e3"])("rejects %s",value=>expect(positiveInventoryWeight(value)).toBeNull());
});
