// Date helpers. Dates are plain "YYYY-MM-DD" strings; times are "HH:MM" Singapore local time.
// Never derive weekdays here: the case study uses a fictional calendar (see root AGENTS.md).

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
