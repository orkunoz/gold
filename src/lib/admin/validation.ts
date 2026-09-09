import type { EmployeeRole } from "@/lib/database.types";
export const ADMIN_ROLES: EmployeeRole[]=["owner","manager","salesperson"];
export function normalizeShopCode(value:string){return value.trim().toUpperCase();}
export function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())&&value.trim().length<=320;}
export function employeeAssignmentValid(role:EmployeeRole,shopId:string,isActive=true){return !isActive||role==="owner"||Boolean(shopId);}
