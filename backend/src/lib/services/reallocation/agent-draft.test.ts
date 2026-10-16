import { describe, expect, it } from "vitest";
import type { Absence, Plan, Session, Therapist } from "@/lib/types";
import { AgentDraft } from "./agent-draft";
import type { EngineStudent } from "./ranking";

const therapists: Therapist[] = [
  { id: 1, name: "Absent A", rank: "SBT", isPartTime: false, homeArea: null },
  { id: 2, name: "Busy B", rank: "BT", isPartTime: false, homeArea: null },
  { id: 3, name: "Free C", rank: "BT", isPartTime: false, homeArea: null },
];
const sessions: Session[] = [
  { id: 10, date: "2031-07-11", slot: "AM", startTime: "08:30", endTime: "12:00", location: "clinic", status: "scheduled", studentId: 100, studentName: "Kid A", therapistId: 1, therapistName: "Absent A", originalTherapistId: null, cancelReason: null, parentStatus: null },
  { id: 11, date: "2031-07-11", slot: "AM", startTime: "08:30", endTime: "12:00", location: "clinic", status: "scheduled", studentId: 101, studentName: "Kid B", therapistId: 2, therapistName: "Busy B", originalTherapistId: null, cancelReason: null, parentStatus: null },
];
const absences: Absence[] = [
  { id: 1, therapistId: 1, therapistName: "Absent A", date: "2031-07-11", slot: null, type: "medical", note: null, reportedAt: "", botReportId: null },
];
const student = (id: number): EngineStudent => ({ id, name: `Kid ${id}`, plan: "Core", homeArea: null, team: new Set(), blacklist: new Set(), history: new Set() });
const plan: Plan = {
  id: 7, date: "2031-07-11", kind: "primary", status: "draft", parentPlanId: null, notifyMode: null,
  createdBy: "engine", createdAt: "", decidedBy: null, decidedAt: null, issues: [],
  assignments: [{ id: 70, planId: 7, sessionId: 10, slot: "AM", startTime: "08:30", endTime: "12:00", location: "clinic", studentId: 100, studentName: "Kid A", studentPlan: "Core", fromTherapistId: 1, fromTherapistName: "Absent A", toTherapistId: 3, toTherapistName: "Free C", step: "tier", distanceKm: null, rationale: ["initial"], chainId: null, editedByAdmin: false, parentStatus: "pending", parentRespondedAt: null }],
};
const ctx = { sessions, absences, therapists, students: new Map([[100, student(100)], [101, student(101)]]), exclusions: new Map<number, Set<number>>() };

describe("AgentDraft", () => {
  it("reuses live availability and refuses a double booking", () => {
    const draft = new AgentDraft(plan, ctx);
    expect(() => draft.setAssignment(70, 2, "Try Busy B")).toThrow(/unavailable.*Booked with Kid B/);
  });

  it("accepts an available replacement and finishes with no conflicts", () => {
    const draft = new AgentDraft(plan, ctx);
    draft.setAssignment(70, 3, "Kid A is compatible with Free C");
    const result = draft.finish();
    expect(result.valid).toBe(true);
    expect(result.assignments[0]).toMatchObject({ toTherapistId: 3, step: "tier" });
    expect(result.assignments[0].rationale[0]).toContain("AI agent");
  });

  it("does not finish with an avoidable cancellation", () => {
    const draft = new AgentDraft(plan, ctx);
    draft.setAssignment(70, null, "Cancel instead");
    const result = draft.finish();
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.level === "error" && issue.message.includes("avoidable"))).toBe(true);
  });
});
