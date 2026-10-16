// HAND-WRITTEN MOCK DATA (not in the case documents). All names and numbers are fictional.
// Replace with real data once Autism Partnership provides it.

/** Child home areas (for distance ranking) and guardian contacts, in SEED_STUDENTS order. */
const AREAS = [
  "Bishan", "Tampines", "Clementi", "Punggol", "Bedok", "Yishun", "Toa Payoh", "Hougang", "Jurong West", "Serangoon",
  "Sengkang", "Ang Mo Kio", "Queenstown", "Woodlands", "Pasir Ris", "Bukit Batok", "Marine Parade", "Geylang",
  "Choa Chu Kang", "Bukit Timah", "Kembangan", "Bukit Panjang", "Sembawang", "Toa Payoh", "Bedok", "Tampines",
  "Clementi", "Hougang", "Bishan", "Punggol",
];
const SURNAMES = ["Tan", "Lim", "Lee", "Ng", "Wong", "Goh", "Chua", "Ong", "Koh", "Teo"];

export function mockStudentProfile(name: string, index: number) {
  return {
    homeArea: AREAS[index % AREAS.length],
    guardianName: `${index % 3 === 0 ? "Mr" : "Mrs"} ${SURNAMES[index % SURNAMES.length]}`,
    // Obviously-fake Singapore-format numbers.
    guardianPhone: `+65 9000 ${String(1000 + index).slice(-4)}`,
  };
}

/** Parents not comfortable with these therapists → engine uses them only as a last resort. */
export const MOCK_BLACKLIST: { student: string; therapist: string; reason: string }[] = [
  { student: "Lola", therapist: "Nadya", reason: "Parent request after a previous session" },
  { student: "Elias", therapist: "Alexa", reason: "Child was distressed in a previous session" },
  { student: "Patrick", therapist: "Jade", reason: "Parent request" },
];

/** Past covers (therapist outside the child's team) so the engine's "history" step has data. */
export const MOCK_PAST_COVERS: { date: string; slot: "AM" | "PM"; student: string; therapist: string }[] = [
  { date: "2031-07-04", slot: "AM", student: "Noddy", therapist: "Jade" },
  { date: "2031-07-06", slot: "AM", student: "Anthony", therapist: "Alexa" },
  { date: "2031-07-05", slot: "PM", student: "Elias", therapist: "Nadya" },
];

const GOALS = ["Requesting with full sentences", "Turn-taking in play", "Matching and sorting", "Following 2-step instructions", "Fine motor: cutting and tracing", "Joint attention"];
const MOODS = ["settled quickly", "needed a few breaks early on", "was very engaged", "was tired after school", "warmed up after 10 minutes"];
const PROGRESS = ["met the target in 4/5 trials", "needed prompting for most trials", "generalised the skill to a new toy", "showed less frustration than last week"];

/** Deterministic mock content for a past session log. */
export function mockLogContent(student: string, i: number) {
  const goal = GOALS[i % GOALS.length];
  return {
    summary: `Worked on ${goal.toLowerCase()}. ${student} ${MOODS[i % MOODS.length]}; ${PROGRESS[i % PROGRESS.length]}.`,
    goals: `${goal}; ${GOALS[(i + 2) % GOALS.length]}`,
    notes: `Reinforcer: ${["stickers", "bubbles", "tablet time", "snack"][i % 4]}. Watch for signs of fatigue after 45 min.`,
  };
}
