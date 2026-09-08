export function formatPrice(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en", { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(value);
}
export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function displayValue(value: string | number | null) {
  return value === null || value === "" ? "—" : String(value);
}
