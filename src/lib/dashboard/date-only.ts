const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

export function parseDashboardDate(value: string | null | undefined) {
  const match = value?.match(DATE_ONLY_PREFIX);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function formatDashboardDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions) {
  const date = parseDashboardDate(value);
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Europe/Kyiv" }).format(date);
}
