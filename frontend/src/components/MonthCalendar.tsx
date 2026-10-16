import type { ReactNode } from "react";
import { formatMonth, WEEKDAYS, weekdayIndex } from "@/lib/format";

export interface CalendarEntry {
  key: string | number;
  content: ReactNode;
  tone?: "normal" | "changed" | "removed" | "cancelled";
}

const TONE = {
  normal: "bg-sunk text-ink-soft",
  changed: "bg-info-bg text-info ring-1 ring-info/40",
  removed: "text-muted line-through",
  cancelled: "bg-bad-bg text-bad",
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
      <p className="mb-3 text-sm font-bold">{formatMonth(month)}</p>
      <div className="grid min-w-[680px] grid-cols-7 gap-1 text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center font-bold text-muted">
            {d}
          </div>
        ))}
        {cells.map((date, i) => (
          <div
            key={date ?? `pad-${i}`}
            className={`min-h-20 rounded-lg p-1.5 ${date === highlightDate ? "bg-[#F3F8F7] ring-2 ring-brand" : date ? "bg-subtle" : ""}`}
          >
            {date && (
              <>
                <div className={`mb-1 font-bold ${date === highlightDate ? "text-brand" : "text-muted"}`}>{Number(date.slice(8))}</div>
                <ul className="space-y-0.5">
                  {(entriesByDate.get(date) ?? []).map((e) => (
                    <li key={e.key} className={`rounded-[5px] px-1.5 py-px leading-[15px] font-semibold ${TONE[e.tone ?? "normal"]}`}>
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
