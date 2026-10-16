import type { ChangeReasonCode, ParentStatus, PlanStep, PreferenceStatus, Rank } from "@/api/types";

export const RANK_LABEL: Record<Rank, string> = {
  SBT: "Senior Behavior Therapist",
  LBT: "Lead Behavior Therapist",
  BT: "Behavior Therapist",
  PT: "Program Therapist",
};

export const isSeniorRank = (r: Rank) => r === "SBT" || r === "LBT";

/** Why an admin moved a proposed therapist off a session. Only the first two can become learned preferences. */
export const REASON_OPTIONS: { code: ChangeReasonCode; label: string; learns: boolean }[] = [
  { code: "child_incompatible", label: "Not compatible with this child", learns: true },
  { code: "therapist_time_unavailable", label: "This time doesn't work for the therapist", learns: true },
  { code: "better_fit", label: "Someone else is a better fit", learns: false },
  { code: "one_off", label: "One-off (today only)", learns: false },
  { code: "other", label: "Other", learns: false },
];
export const REASON_LABEL = Object.fromEntries(REASON_OPTIONS.map((o) => [o.code, o.label])) as Record<ChangeReasonCode, string>;

export const PREFERENCE_STATUS_LABEL: Record<PreferenceStatus, string> = {
  suggested: "Needs your answer",
  active: "Active",
  paused: "Paused",
  rejected: "Not a rule",
  removed: "Removed",
};

/** How a replacement was chosen — the agreed rule order (docs/plans/rescheduling.md). */
export const STEP_LABEL: Record<PlanStep, string> = {
  team: "Same team",
  tier: "Tier match",
  history: "Covered before",
  any: "Any available",
  blacklisted: "Blacklisted",
  swap: "Swap",
  cancel: "Cancel",
  manual: "Admin choice",
};

export const STEP_TONE: Record<PlanStep, "success" | "info" | "warning" | "danger" | "neutral"> = {
  team: "success",
  tier: "success",
  history: "info",
  any: "warning",
  blacklisted: "danger",
  swap: "info",
  cancel: "danger",
  manual: "neutral",
};

export const PARENT_STATUS_LABEL: Record<ParentStatus, string> = {
  pending: "Awaiting parent",
  accepted: "Parent accepted",
  declined: "Parent declined",
  expired: "No reply — cancelled",
  not_required: "No reply needed",
};

/** "14:00" → "2:00 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "08:30" → "8:15 AM" (the parent's reply deadline: start − 15 min) */
export function parentDeadline(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const mins = h * 60 + m - 15;
  return formatTime(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) → local date-time string. */
export function formatTimestamp(sqliteUtc: string): string {
  return new Date(sqliteUtc.replace(" ", "T") + "Z").toLocaleString();
}

/** Reported-at times from the bot are already local; show only HH:MM if it's the same date. */
export function formatReportedAt(value: string, date: string): string {
  const [d, t] = value.split(" ");
  return d === date && t ? t.slice(0, 5) : value.slice(0, 16);
}

/** "+65 9000 1234" → "+65 ••• 1234" (enough to recognise, not to copy). */
export function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  return `+${digits.slice(0, 2)} ••• ${digits.slice(-4)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Day of week (0 = Sun). July 2031 follows the CASE STUDY calendar (3 July = Monday), which differs from the
 * real calendar — see root AGENTS.md. Other months use the real calendar.
 */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (y === 2031 && m === 7) return (((d - 3) % 7) + 7 + 1) % 7;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2031-07-11" → "Tue 11 Jul" */
export function formatCaseDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[weekdayIndex(date)]} ${d} ${MONTHS[m - 1]}`;
}

/** "2031-07" → "July 2031" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" })} ${y}`;
}
