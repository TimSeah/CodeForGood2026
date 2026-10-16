// Date helpers. Dates are plain "YYYY-MM-DD" strings; times are "HH:MM" Singapore local time.
// Weekdays: only via caseWeekday() — the case study uses a fictional calendar (see root AGENTS.md).

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Day of week (0 = Sun … 6 = Sat). July 2031 follows the CASE STUDY calendar (3 July = Monday), which differs from
 * the real one; other months use the real calendar. Mirrors weekdayIndex() in frontend/src/lib/format.ts.
 */
export function caseWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (y === 2031 && m === 7) return (((d - 3) % 7) + 7 + 1) % 7;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2031-07-11" → "Tue 11 Jul" (case-study calendar). */
export function formatCaseDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${WEEKDAY_NAMES[caseWeekday(date)]} ${d} ${month}`;
}

/** "17:30" → "5:30 pm" */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Every date from start to end inclusive. Capped to avoid runaway ranges from bad input. */
export function eachDate(start: string, end: string, max = 366): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && out.length < max) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const PARENT_DEADLINE_MINUTES = 15;

/** The instant a parent must have replied by: session start − 15 minutes (Singapore time, UTC+8). */
export function parentDeadline(date: string, startTime: string): Date {
  return new Date(Date.parse(`${date}T${startTime}:00+08:00`) - PARENT_DEADLINE_MINUTES * 60_000);
}

/** "09:00" minus 15 minutes → "08:45" */
export function deadlineTime(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const mins = h * 60 + m - PARENT_DEADLINE_MINUTES;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
