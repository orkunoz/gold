export const MAX_PURCHASE_PRICE = 999_999_999_999.99;

export function parseRequiredPurchasePrice(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PURCHASE_PRICE) return null;
  return parsed;
}
