const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", numberingSystem: "latn", day: "2-digit", month: "2-digit", year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", numberingSystem: "latn", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
type DateInput = string | number | Date | null | undefined;

function parsed(value: DateInput) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Assemble fixed text from explicit locale/timezone parts for identical SSR and hydration. */
export function formatCampusDate(value: DateInput) {
  const date = parsed(value);
  if (!date) return "—";
  const parts = dateFormat.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
  return `${part("day")}/${part("month")}/${part("year")}`;
}

export function formatCampusDateTime(value: DateInput) {
  const date = parsed(value);
  if (!date) return "—";
  const parts = timeFormat.formatToParts(date);
  return `${formatCampusDate(date)} ${parts.find(p => p.type === "hour")?.value}:${parts.find(p => p.type === "minute")?.value}`;
}
