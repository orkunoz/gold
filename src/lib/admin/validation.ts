import type { EmployeeRole } from "@/lib/database.types";
export const ADMIN_ROLES: EmployeeRole[]=["owner","salesperson"];
export function normalizeShopCode(value:string){return value.trim().toUpperCase();}
export function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())&&value.trim().length<=320;}
export function normalizeUsername(value:string){return value.trim().toLowerCase();}
export function validUsername(value:string){return /^[a-z0-9][a-z0-9_-]{2,31}$/.test(normalizeUsername(value));}
export function employeeAssignmentValid(role:EmployeeRole,shopId:string,isActive=true){return !isActive||role==="owner"||Boolean(shopId);}
export function friendlyAdminError(message:string){
  const normalized=message.toLowerCase();
  if(normalized.includes("already has an active salesperson"))return "This shop already has an active Salesperson.";
  if(normalized.includes("duplicate")||normalized.includes("unique")||normalized.includes("already exists"))return "That code or employee identity already exists.";
  if(normalized.includes("active employees"))return "Deactivate or reassign active employees before deactivating this shop.";
  if(normalized.includes("in-stock")||normalized.includes("reserved inventory"))return "Move or remove in-stock and reserved inventory before deactivating this shop.";
  if(normalized.includes("last active owner"))return "The last active Owner cannot be deactivated or assigned another role.";
  if(normalized.includes("active shop"))return "Select an active shop for this employee.";
  if(normalized.includes("owner access")||normalized.includes("permission"))return "You do not have permission to make this change.";
  return "The administration change could not be completed.";
}
