export function kyivCalendarDateBoundaries(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const midnight = (date: Date) => {
    const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    const parts = Object.fromEntries(formatter.formatToParts(new Date(target)).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
    const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - target;
    return new Date(target - offset).toISOString();
  };
  return { start: midnight(calendar), end: midnight(new Date(Date.UTC(year, month - 1, day + 1))) };
}
