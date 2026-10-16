import { describe, expect, it } from "vitest";
import type { Absence, Session, Therapist } from "@/lib/types";
import { proposeReallocations } from "./engine";

const therapist = (id: number, name: string, rank: Therapist["rank"]): Therapist => ({
  id,
  name,
  rank,
  isPartTime: false,
  homeArea: null,
});

const session = (id: number, studentId: number, therapistId: number, extra: Partial<Session> = {}): Session => ({
  id,
  date: "2031-07-11",
  slot: "AM",
  startTime: "08:30",
  endTime: "12:00",
  location: "clinic",
  status: "scheduled",
  studentId,
  studentName: `Student ${studentId}`,
  therapistId,
  therapistName: null,
  originalTherapistId: null,
  cancelReason: null,
  ...extra,
});

const absent = (therapistId: number, slot: Absence["slot"] = null): Absence => ({
  id: therapistId,
  therapistId,
  therapistName: "",
  date: "2031-07-11",
  slot,
  type: "medical",
  note: null,
  reportedAt: "",
});

const therapists = [therapist(1, "Senior A", "SBT"), therapist(2, "Senior B", "SBT"), therapist(3, "Junior C", "PT")];

describe("proposeReallocations", () => {
  it("prefers a free therapist already on the child's team", () => {
    const [p] = proposeReallocations({
      sessions: [session(10, 100, 1)],
      absences: [absent(1)],
      therapists,
      teams: new Map([[100, new Set([1, 3])]]),
    });
    expect(p.toTherapistId).toBe(3);
    expect(p.rationale).toContain("Already on the child's team");
  });

  it("prefers senior → senior when nobody on the team is free", () => {
    const [p] = proposeReallocations({
      sessions: [session(10, 100, 1)],
      absences: [absent(1)],
      therapists,
      teams: new Map([[100, new Set([1])]]),
    });
    expect(p.toTherapistId).toBe(2);
  });

  it("cancels home/school sessions instead of reassigning", () => {
    const [p] = proposeReallocations({
      sessions: [session(10, 100, 1, { location: "home" })],
      absences: [absent(1)],
      therapists,
      teams: new Map(),
    });
    expect(p.toTherapistId).toBeNull();
  });

  it("does not double-book a replacement and cancels when nobody is free", () => {
    const proposals = proposeReallocations({
      sessions: [session(10, 100, 1), session(11, 101, 2), session(12, 102, 3)],
      absences: [absent(1), absent(2)],
      therapists,
      teams: new Map(),
    });
    expect(proposals.every((p) => p.toTherapistId === null)).toBe(true);
  });

  it("only treats a half-day absence as affecting that slot", () => {
    const proposals = proposeReallocations({
      sessions: [session(10, 100, 1, { slot: "AM" })],
      absences: [absent(1, "PM")],
      therapists,
      teams: new Map(),
    });
    expect(proposals).toHaveLength(0);
  });
});
