import { getDb } from "@/lib/db/client";
import type { Location, MonthlyPatternRow, Rank, Slot } from "@/lib/types";

interface PatternRow {
  therapist_id: number;
  therapist_name: string;
  rank: Rank;
  is_part_time: number;
  home_area: string | null;
  days: "MWF" | "TT" | null;
  slot: Slot | null;
  start_time: string | null;
  end_time: string | null;
  student_name: string | null;
  location: Location | null;
  is_off: number | null;
}

/** The monthly MWF/TT allocation table, one row per therapist (every therapist, even without patterns). */
export function listMonthlyPatterns(month: string): MonthlyPatternRow[] {
  const rows = getDb()
    .prepare(
      `SELECT t.id AS therapist_id, t.name AS therapist_name, t.rank, t.is_part_time, t.home_area,
              wp.days, wp.slot, wp.start_time, wp.end_time, wp.location, wp.is_off, s.name AS student_name
       FROM therapists t
       LEFT JOIN weekly_patterns wp ON wp.therapist_id = t.id AND wp.month = ?
       LEFT JOIN students s ON s.id = wp.student_id
       ORDER BY CASE t.rank WHEN 'SBT' THEN 1 WHEN 'LBT' THEN 2 WHEN 'BT' THEN 3 ELSE 4 END, t.id, wp.slot, s.name`,
    )
    .all(month) as PatternRow[];

  const out = new Map<number, MonthlyPatternRow>();
  for (const r of rows) {
    if (!out.has(r.therapist_id)) {
      out.set(r.therapist_id, {
        therapistId: r.therapist_id,
        therapistName: r.therapist_name,
        rank: r.rank,
        isPartTime: r.is_part_time === 1,
        homeArea: r.home_area,
        slots: { AM: { MWF: [], TT: [] }, PM: { MWF: [], TT: [] } },
      });
    }
    if (!r.days || !r.slot) continue;
    out.get(r.therapist_id)!.slots[r.slot][r.days].push({
      off: r.is_off === 1,
      startTime: r.start_time,
      endTime: r.end_time,
      studentName: r.student_name,
      location: r.location ?? "clinic",
    });
  }
  return [...out.values()];
}
