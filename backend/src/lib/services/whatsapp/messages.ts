import type { PlanAssignment, SessionLog, Student } from "@/lib/types";

// The outbox displays these messages; the bot sends the equivalent approved Meta templates.

// Set CENTRE_PHONE in .env.local; the placeholder makes a missing value obvious in the outbox.
export const CENTRE_PHONE = process.env.CENTRE_PHONE || "[centre phone]";

const t12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};

export const sessionWhen = (a: Pick<PlanAssignment, "startTime" | "endTime">, date: string) =>
  `${date}, ${t12(a.startTime)}–${t12(a.endTime)}`;

export function parentConfirmMessage(a: PlanAssignment, date: string, student: Student, deadline: string) {
  return [
    `Hi ${student.guardianName ?? "there"}, this is Autism Partnership.`,
    `${a.fromTherapistName} is unable to make ${student.name}'s session on ${sessionWhen(a, date)}.`,
    `${a.toTherapistName} will take the session instead${a.step === "team" ? " (already part of " + student.name + "'s team)" : ""}.`,
    `Please reply YES ${a.id} to confirm or NO ${a.id} if you'd prefer a call by ${t12(deadline)}. If we don't hear back by then, we'll cancel the session.`,
  ].join("\n");
}

export function parentCancelledMessage(a: PlanAssignment, date: string, student: Student) {
  return [
    `Hi ${student.guardianName ?? "there"}, this is Autism Partnership.`,
    `We're sorry — we couldn't arrange a therapist for ${student.name}'s session on ${sessionWhen(a, date)}, so it is cancelled.`,
    `Please call us at ${CENTRE_PHONE} if you'd like to discuss a make-up session.`,
  ].join("\n");
}

export function parentCallCentreMessage(student: Student) {
  return [
    `Thank you for letting us know. We'll look for another therapist for ${student.name}.`,
    `If you'd like to talk it through, please call the centre at ${CENTRE_PHONE}.`,
  ].join("\n");
}

export function therapistCoverMessage(a: PlanAssignment, date: string, previous: SessionLog | null) {
  const lines = [
    `Hi ${a.toTherapistName}, please cover ${a.studentName}'s ${a.location} session on ${sessionWhen(a, date)} (usually with ${a.fromTherapistName}).`,
    `This is pending the parent's confirmation; we'll let you know.`,
  ];
  if (previous) {
    lines.push(
      "",
      `Last session: ${previous.date} ${previous.slot} with ${previous.therapistName} (${previous.attendance}).`,
      previous.summary ? `Summary: ${previous.summary}` : "No summary recorded.",
      previous.goals ? `Goals: ${previous.goals}` : "",
      "The full handover is available in the staff portal.",
    );
  } else {
    lines.push("", "No previous session log on record for this child.");
  }
  return lines.filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n");
}

export const therapistConfirmedMessage = (a: PlanAssignment, date: string) =>
  `Confirmed: ${a.studentName}'s parent accepted. Please go ahead with the session on ${sessionWhen(a, date)}.`;

export const therapistStandDownMessage = (a: PlanAssignment, date: string, why: string) =>
  `Update: please do NOT go to ${a.studentName}'s session on ${sessionWhen(a, date)} — ${why}.`;
