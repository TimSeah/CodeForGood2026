import type { Rank } from "@/api/types";

export const RANK_LABEL: Record<Rank, string> = {
  SBT: "Senior Behavior Therapist",
  LBT: "Lead Behavior Therapist",
  BT: "Behavior Therapist",
  PT: "Program Therapist",
};

/** "14:00" → "2:00 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) → local date-time string. */
export function formatTimestamp(sqliteUtc: string): string {
  return new Date(sqliteUtc.replace(" ", "T") + "Z").toLocaleString();
}
