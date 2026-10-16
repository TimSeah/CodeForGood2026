import type { ReactNode } from "react";
import { formatMonth, WEEKDAYS, weekdayIndex } from "@/lib/format";

export interface CalendarEntry {
  key: string | number;
  content: ReactNode;
  tone?: "normal" | "changed" | "removed" | "cancelled";
}

const TONE = {
  normal: "text-slate-700",
  changed: "rounded bg-sky-100 px-1 text-sky-900",
  removed: "text-slate-400 line-through",
  cancelled: "rounded bg-rose-100 px-1 text-rose-800",
};

/** Sun–Sat month grid like the per-person sheets in Therapists-/Students-Schedule.xlsx. */
export function MonthCalendar({
  month,
  entriesByDate,
  highlightDate,
}: {
  month: string; // YYYY-MM
  entriesByDate: Map<string, CalendarEntry[]>;
  highlightDate?: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const leading = weekdayIndex(dates[0]);
  const cells: (string | null)[] = [...Array(leading).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-medium">{formatMonth(month)}</p>
      <div className="grid min-w-[640px] grid-cols-7 border-l border-t border-slate-200 text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-r border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((date, i) => (
          <div
            key={date ?? `pad-${i}`}
            className={`min-h-20 border-b border-r border-slate-200 p-1.5 ${date === highlightDate ? "bg-amber-50 ring-2 ring-inset ring-amber-300" : ""}`}
          >
            {date && (
              <>
                <div className="mb-1 text-slate-400">{Number(date.slice(8))}</div>
                <ul className="space-y-0.5">
                  {(entriesByDate.get(date) ?? []).map((e) => (
                    <li key={e.key} className={TONE[e.tone ?? "normal"]}>
                      {e.content}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
