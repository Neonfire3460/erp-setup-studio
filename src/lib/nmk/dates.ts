// dates.ts: "Needed by" and "Prices effective from" on tickets, and the week groups on the admin queues.
// Dates are plain "YYYY-MM-DD" strings (no time zone). The review takes at least 2 days, so the earliest
// "Needed by" is today + 3: today and the next two days can't be picked.

export const REVIEW_DAYS = 2;
export const MIN_LEAD_DAYS = REVIEW_DAYS + 1;

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
export const today = () => addDays(new Date(), 0);
export const earliestNeededBy = (from = today()) => addDays(from, MIN_LEAD_DAYS);
export const daysBetween = (a: Date, b: Date) =>
  Math.round((addDays(b, 0).getTime() - addDays(a, 0).getTime()) / 86_400_000);

/** "Thu 4 Dec" */
export const fmtDay = (s: string | null | undefined) =>
  s
    ? parseIso(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "";

/** Monday of the week (weeks run Monday to Sunday). */
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export type WeekGroup = "overdue" | "this_week" | "next_week" | "later" | "no_date";
export const WEEK_LABEL: Record<WeekGroup, string> = {
  overdue: "Overdue",
  this_week: "Needed this week",
  next_week: "Needed next week",
  later: "Later",
  no_date: "No date given",
};
export const WEEK_ORDER: WeekGroup[] = ["overdue", "this_week", "next_week", "later", "no_date"];

export function weekGroup(neededBy: string | null | undefined, now = today()): WeekGroup {
  if (!neededBy) return "no_date";
  const d = parseIso(neededBy);
  if (d < now) return "overdue";
  const w = daysBetween(monday(now), monday(d)) / 7;
  return w <= 0 ? "this_week" : w === 1 ? "next_week" : "later";
}

/** "in 3 days", "today", "2 days late" */
export function dueText(neededBy: string | null | undefined, now = today()) {
  if (!neededBy) return "";
  const n = daysBetween(now, parseIso(neededBy));
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 0) return `in ${n} days`;
  return `${-n} day${n === -1 ? "" : "s"} late`;
}

/** Server check: the browser's "today" may be a day ahead of the server's (Dubai vs UTC), so allow one day. */
export function checkNeededBy(neededBy: string, effectiveFrom?: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neededBy)) return "Pick the date you need this by";
  const min = isoDate(addDays(today(), MIN_LEAD_DAYS - 1));
  if (neededBy < min)
    return `The review takes at least ${REVIEW_DAYS} days. Pick a date from ${fmtDay(isoDate(earliestNeededBy()))}`;
  if (effectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom))
    return "The effective date is not a date";
  return null;
}
