import {describe,expect,it} from "vitest";import {employeeAssignmentValid,friendlyAdminError,normalizeShopCode,normalizeUsername,validUsername} from "./validation";
describe("admin validation",()=>{
 it("normalizes shop codes and usernames",()=>{expect(normalizeShopCode(" kyiv-1 ")).toBe("KYIV-1");expect(normalizeUsername(" Staff_1 ")).toBe("staff_1");});
 it("validates current usernames",()=>{expect(validUsername("staff_1")).toBe(true);expect(validUsername("bad email")).toBe(false);});
 it("allows operational accounts to be unassigned",()=>{expect(employeeAssignmentValid("salesperson","",true)).toBe(true);expect(employeeAssignmentValid("salesperson","shop",true)).toBe(true);expect(employeeAssignmentValid("owner","",true)).toBe(true);});
 it("maps expected blockers without leaking database details",()=>{expect(friendlyAdminError("Deactivate or reassign active employees first.")).toContain("active accounts");expect(friendlyAdminError("A shop with in-stock inventory cannot be deactivated.")).toContain("in-stock inventory");expect(friendlyAdminError("relation public.secret_table does not exist")).toBe("The administration change could not be completed.");});
});
