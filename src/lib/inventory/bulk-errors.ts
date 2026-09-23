type DatabaseError = { code?: string; message?: string } | null;
type Translator = (key: string, params?: Record<string, string | number>) => string;

export function bulkInventoryError(error: DatabaseError, t: Translator, fallbackKey: string) {
  if (error?.code === "42501") return t("inventory.ownerRequired");
  if (error?.code === "22023" && /(?:ineligible|sold product|cannot be moved)/i.test(error.message ?? "")) return t("inventory.ineligibleSelection");
  return t(fallbackKey);
}
