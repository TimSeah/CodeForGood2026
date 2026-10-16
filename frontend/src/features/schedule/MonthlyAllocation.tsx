import type { MonthlyPatternRow, PatternCell, Slot } from "@/api/types";
import { Badge, Card, QueryState } from "@/components/ui";
import { formatMonth, formatTime, isSeniorRank, RANK_LABEL } from "@/lib/format";
import { useMonthlyPattern } from "./api";

/** The monthly allocation table, laid out like the "July 2031 Allocation" sheet: one row per therapist per slot. */
export function MonthlyAllocation({ month }: { month: string }) {
  const { data = [], isLoading, error } = useMonthlyPattern(month);
  return (
    <Card title={`Schedule overview — ${formatMonth(month)}`}>
      <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No allocation for this month." />
      {data.length > 0 && (
        <>
          <Legend />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-subtle text-xs text-ink-soft">
                  <th rowSpan={2} className="border border-line px-2.5 py-1.5">No.</th>
                  <th rowSpan={2} className="border border-line px-2.5 py-1.5">Therapist</th>
                  <th rowSpan={2} className="border border-line px-2.5 py-1.5">Seniority</th>
                  <th rowSpan={2} className="border border-line px-2.5 py-1.5">Location</th>
                  <th colSpan={2} className="border border-line px-2.5 py-1.5 text-center">Mon · Wed · Fri</th>
                  <th colSpan={2} className="border border-line px-2.5 py-1.5 text-center">Tue · Thu</th>
                </tr>
                <tr className="bg-subtle text-xs text-ink-soft">
                  <th className="border border-line px-2.5 py-1.5">Time</th>
                  <th className="border border-line px-2.5 py-1.5">Student</th>
                  <th className="border border-line px-2.5 py-1.5">Time</th>
                  <th className="border border-line px-2.5 py-1.5">Student</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <TherapistRows key={row.therapistId} row={row} no={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function Legend() {
  return (
    <div className="mb-4 flex flex-wrap gap-4 text-xs text-ink-soft">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-good-bg" /> Available (no child)
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-sm bg-sunk" /> Not working
      </span>
      <span>Standard times 8:30–12:00 · 2:00–5:30; others shown in amber</span>
    </div>
  );
}

const STANDARD: Record<Slot, [string, string]> = { AM: ["08:30", "12:00"], PM: ["14:00", "17:30"] };

function TherapistRows({ row, no }: { row: MonthlyPatternRow; no: number }) {
  return (
    <>
      {(["AM", "PM"] as const).map((slot) => (
        <tr key={slot} className={slot === "PM" ? "border-b-2 border-field" : ""}>
          {slot === "AM" && (
            <>
              <td rowSpan={2} className="border border-line px-2.5 py-1.5 text-muted">
                {no}
              </td>
              <td rowSpan={2} className="border border-line px-2.5 py-1.5 font-medium">
                {row.therapistName}
                {row.isPartTime && <span className="ml-1 text-xs text-muted">(PT)</span>}
              </td>
              <td rowSpan={2} className="border border-line px-2.5 py-1.5" title={RANK_LABEL[row.rank]}>
                <Badge tone={isSeniorRank(row.rank) ? "info" : "neutral"}>{row.rank}</Badge>
              </td>
              <td rowSpan={2} className="border border-line px-2.5 py-1.5 text-ink-soft">
                {row.homeArea ?? "—"}
              </td>
            </>
          )}
          <Cells cells={row.slots[slot].MWF} slot={slot} />
          <Cells cells={row.slots[slot].TT} slot={slot} />
        </tr>
      ))}
    </>
  );
}

function Cells({ cells, slot }: { cells: PatternCell[]; slot: Slot }) {
  const cls = "border border-line px-2.5 py-1.5";
  if (cells.some((c) => c.off)) {
    return (
      <td colSpan={2} className={`${cls} bg-sunk text-center text-xs text-muted`}>
        Not working
      </td>
    );
  }
  if (cells.length === 0) {
    return (
      <>
        <td className={`${cls} bg-good-bg/60 text-xs text-muted`}>
          {formatTime(STANDARD[slot][0])} – {formatTime(STANDARD[slot][1])}
        </td>
        <td className={`${cls} bg-good-bg/60 text-xs text-good`}>Available</td>
      </>
    );
  }
  const c = cells[0];
  const nonStandard = c.startTime !== STANDARD[slot][0] || c.endTime !== STANDARD[slot][1];
  return (
    <>
      <td className={`${cls} whitespace-nowrap text-xs ${nonStandard ? "bg-warn-bg text-warn" : "text-ink-soft"}`}>
        {c.startTime && c.endTime ? `${formatTime(c.startTime)} – ${formatTime(c.endTime)}` : "—"}
      </td>
      <td className={cls}>
        {cells.map((x) => x.studentName).join(" / ")}
        {c.location !== "clinic" && <span className="ml-1 text-xs capitalize text-muted">({c.location})</span>}
      </td>
    </>
  );
}
