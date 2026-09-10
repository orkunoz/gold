import type { InventoryStatus } from "@/lib/database.types";

export const INVENTORY_STATUSES: InventoryStatus[] = [
  "IN_STOCK",
  "SOLD",
  "REMOVED",
];

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  IN_STOCK: "In stock",
  SOLD: "Sold",
  REMOVED: "Removed",
};
