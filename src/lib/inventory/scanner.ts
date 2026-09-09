import type { InventoryStatus } from "@/lib/database.types";

export function normalizeScannedBarcode(value: string) {
  return value.trim();
}

export function scannerSubmissionValue(value: string) {
  return normalizeScannedBarcode(value) || null;
}

export function applyExactBarcodeMatch<T>(query: { eq(column: string, value: string): T }, barcode: string): T {
  return query.eq("barcode", normalizeScannedBarcode(barcode));
}

export function scanStatusWarning(status: InventoryStatus) {
  if (status === "SOLD") return "This item is already sold.";
  if (status === "REMOVED") return "This item has been removed from inventory.";
  return null;
}

export function scanAnotherHref() {
  return "/inventory?scan=1";
}
