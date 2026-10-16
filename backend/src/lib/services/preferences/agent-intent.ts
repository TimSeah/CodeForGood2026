import { WEEKDAY_NAMES } from "@/lib/dates";

// PURE: does an AI-agent instruction look like a LASTING preference (not just "for today")? If so, the service
// turns it into a SUGGESTION the admin must confirm. Nothing here ever saves an active rule.

const PERSISTENT =
  /\b(always|never|from now on|in (the )?future|future schedules|going forward|permanent(ly)?|every (time|week|day)|ongoing|remember|any ?more|no longer|all the time)\b/i;
const HARD = /\b(never|must not|mustn't|can ?not ever|not compatible|incompatible|don't ever|do not ever)\b/i;
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const DAY_WORDS: [RegExp, number[]][] = [
  [/\bweekdays?\b/i, [1, 2, 3, 4, 5]],
  [/\bmwf\b/i, [1, 3, 5]],
  [/\btt\b|\btue(sday)?s? and thu(rsday)?s?\b/i, [2, 4]],
  ...WEEKDAY_NAMES.map((d, i): [RegExp, number[]] => [new RegExp(`\\b${d}(day|nesday|rsday|urday|sday)?s?\\b`, "i"), [i]]),
];

export interface PromptPreferenceIntent {
  type: "pairing" | "time_unavailable";
  therapistId: number;
  studentId: number | null;
  strength: "soft" | "hard";
  /** time only, if stated; the admin still confirms start/end, days and dates. */
  boundaryTime: string | null;
  days: number[] | null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentioned = (prompt: string, name: string) => new RegExp(`(^|[^\\p{L}])${escape(name)}([^\\p{L}]|$)`, "iu").test(prompt);

export function detectPersistentPreference(
  prompt: string,
  therapists: { id: number; name: string }[],
  students: { id: number; name: string }[],
): PromptPreferenceIntent | null {
  if (!PERSISTENT.test(prompt)) return null;

  // Names that are both a therapist and a child (e.g. "Janelle Lui") are ambiguous: ignore them.
  const childNames = new Set(students.map((s) => s.name.toLowerCase()));
  const therapistNames = new Set(therapists.map((t) => t.name.toLowerCase()));
  const t = therapists.filter((x) => !childNames.has(x.name.toLowerCase()) && mentioned(prompt, x.name));
  const s = students.filter((x) => !therapistNames.has(x.name.toLowerCase()) && mentioned(prompt, x.name));
  if (t.length !== 1 || s.length > 1) return null;

  const strength = HARD.test(prompt) ? "hard" : "soft";
  if (s.length === 1) {
    return { type: "pairing", therapistId: t[0].id, studentId: s[0].id, strength, boundaryTime: null, days: null };
  }

  const time = prompt.match(TIME);
  if (!time) return null;
  let hour = Number(time[1]) % 12;
  if (time[3].toLowerCase() === "pm") hour += 12;
  const boundaryTime = `${String(hour).padStart(2, "0")}:${time[2] ?? "00"}`;
  const days = [...new Set(DAY_WORDS.filter(([re]) => re.test(prompt)).flatMap(([, d]) => d))].sort();
  return {
    type: "time_unavailable",
    therapistId: t[0].id,
    studentId: null,
    strength: "hard",
    boundaryTime,
    days: days.length ? days : null,
  };
}
