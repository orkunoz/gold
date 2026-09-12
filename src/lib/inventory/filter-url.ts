import type { EmployeeRole } from "@/lib/database.types";

export const INVENTORY_FILTER_DEBOUNCE_MS = 400;

export const TEXT_INVENTORY_FILTERS = ["barcode", "article", "search"] as const;
export const SELECT_INVENTORY_FILTERS = ["category", "status", "shop"] as const;

export function inventoryFilterFields(role: EmployeeRole) {
  return role === "owner"
    ? [...TEXT_INVENTORY_FILTERS, ...SELECT_INVENTORY_FILTERS]
    : [...TEXT_INVENTORY_FILTERS, ...SELECT_INVENTORY_FILTERS.filter((field) => field !== "shop")];
}

export function inventoryHref(currentQuery: string, updates: Record<string, string>, pathname = "/inventory") {
  const params = new URLSearchParams(currentQuery);
  params.delete("metal");
  if (params.get("status") === "REMOVED") params.delete("status");
  params.delete("page");
  params.delete("mode");
  for (const [name, value] of Object.entries(updates)) {
    const normalized = value.trim();
    if (normalized) params.set(name, normalized);
    else params.delete(name);
  }
  return `${pathname}${params.size ? `?${params.toString()}` : ""}`;
}

export function inventoryPageHref(currentQuery: string, page: number) {
  const params = new URLSearchParams(currentQuery);
  params.delete("metal");
  if (params.get("status") === "REMOVED") params.delete("status");
  params.delete("mode");
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  return `/inventory${params.size ? `?${params.toString()}` : ""}`;
}
