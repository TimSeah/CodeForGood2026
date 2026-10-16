import { describe, expect, it } from "vitest";
import type { ChangeReasonCode, PreferenceEvidence } from "@/lib/types";
import { detectPersistentPreference } from "./agent-intent";
import { detectSuggestions, pairingSignature, timeSignature } from "./detect";

let nextId = 1;
const event = (date: string, reasonCode: ChangeReasonCode | null, extra: Partial<PreferenceEvidence> = {}): PreferenceEvidence => ({
  eventId: nextId++,
  date,
  slot: "PM",
  startTime: "14:00",
  endTime: "17:30",
  studentId: 100,
  studentName: "Anthony",
  removedTherapistId: 7,
  removedTherapistName: "Jade",
  newTherapistName: "Alexa",
  action: "edited",
  reasonCode,
  reasonNote: null,
  actor: "admin",
  createdAt: `${date} 07:10:00`,
  ...extra,
});

const pairEvents = (dates: string[]) => dates.map((d) => event(d, "child_incompatible"));

describe("detectSuggestions", () => {
  it("suggests a pairing after 3 similar changes on separate dates, with evidence and a clear question", () => {
    const [s] = detectSuggestions(pairEvents(["2031-07-04", "2031-07-07", "2031-07-11"]), [], 3);
    expect(s).toMatchObject({ type: "pairing", therapistId: 7, studentId: 100, signature: pairingSignature(7, 100) });
    expect(s.evidenceEventIds).toHaveLength(3);
    expect(s.question).toMatch(/I noticed Jade was replaced for Anthony on 3 separate dates .*Should I avoid this pairing in future schedules\?/);
  });

  it("counts distinct dates, not edits", () => {
    const sameDay = pairEvents(["2031-07-04", "2031-07-04", "2031-07-04", "2031-07-07"]);
    expect(detectSuggestions(sameDay, [], 3)).toHaveLength(0);
  });

  it("ignores changes without a reason, and reasons that aren't pattern evidence", () => {
    const events = [
      event("2031-07-04", null),
      event("2031-07-07", "one_off"),
      event("2031-07-11", "better_fit"),
      event("2031-07-12", "child_incompatible"),
    ];
    expect(detectSuggestions(events, [], 3)).toHaveLength(0);
  });

  it("respects a configurable threshold", () => {
    expect(detectSuggestions(pairEvents(["2031-07-04", "2031-07-07"]), [], 2)).toHaveLength(1);
    expect(detectSuggestions(pairEvents(["2031-07-04", "2031-07-07", "2031-07-11"]), [], 4)).toHaveLength(0);
  });

  it("never re-suggests a rejected, active or paused preference", () => {
    const events = pairEvents(["2031-07-04", "2031-07-07", "2031-07-11", "2031-07-12"]);
    for (const status of ["rejected", "active", "paused"] as const) {
      expect(detectSuggestions(events, [{ signature: pairingSignature(7, 100), status, removedAfterEventId: null }], 3)).toHaveLength(0);
    }
  });

  it("after a rule is removed, only evidence recorded after the removal counts", () => {
    const before = pairEvents(["2031-07-04", "2031-07-07", "2031-07-11"]);
    const removed = [{ signature: pairingSignature(7, 100), status: "removed" as const, removedAfterEventId: before.at(-1)!.eventId }];
    expect(detectSuggestions(before, removed, 3)).toHaveLength(0);
    const after = pairEvents(["2031-07-12", "2031-07-14", "2031-07-15"]);
    expect(detectSuggestions([...before, ...after], removed, 3)[0].evidenceEventIds).toEqual(after.map((e) => e.eventId));
  });

  it("returns an open suggestion again so its evidence can be refreshed", () => {
    const open = [{ signature: pairingSignature(7, 100), status: "suggested" as const, removedAfterEventId: null }];
    expect(detectSuggestions(pairEvents(["2031-07-04", "2031-07-07", "2031-07-11"]), open, 3)).toHaveLength(1);
  });

  it("time suggestions show the actual session times and leave the exact boundary to the admin", () => {
    const events = ["2031-07-03", "2031-07-05", "2031-07-07"].map((d) =>
      event(d, "therapist_time_unavailable", { startTime: "14:45", endTime: "17:15" }),
    );
    const [s] = detectSuggestions(events, [], 3);
    expect(s).toMatchObject({ type: "time_unavailable", signature: timeSignature(7), studentId: null });
    expect(s.days).toEqual([1, 3, 5]); // Mon, Wed, Fri in the case-study calendar
    expect(s.question).toMatch(/2:45 pm–5:15 pm/);
    expect(s.question).toMatch(/confirm the exact cut-off time, whether it applies to the session's start or end/);
  });
});

describe("detectPersistentPreference (agent prompts)", () => {
  const therapists = [{ id: 7, name: "Jade" }, { id: 8, name: "Alexa" }, { id: 9, name: "Janelle Lui" }];
  const students = [{ id: 100, name: "Anthony" }, { id: 101, name: "Janelle Lui" }];

  it("ignores one-off instructions", () => {
    expect(detectPersistentPreference("Don't use Jade for Anthony today", therapists, students)).toBeNull();
  });

  it("flags lasting pairing instructions, hard for 'never'", () => {
    expect(detectPersistentPreference("Never put Jade with Anthony again", therapists, students)).toMatchObject({
      type: "pairing", therapistId: 7, studentId: 100, strength: "hard",
    });
    expect(detectPersistentPreference("From now on try to avoid Jade for Anthony", therapists, students)).toMatchObject({
      type: "pairing", strength: "soft",
    });
  });

  it("flags lasting time instructions and parses the time and days, but never guesses start vs end", () => {
    const intent = detectPersistentPreference("Going forward Alexa can't do anything after 5pm on Mondays", therapists, students);
    expect(intent).toMatchObject({ type: "time_unavailable", therapistId: 8, boundaryTime: "17:00", days: [1] });
  });

  it("ignores ambiguous names (therapist and child with the same name) and multiple therapists", () => {
    expect(detectPersistentPreference("Never pair Janelle Lui with Anthony", therapists, students)).toBeNull();
    expect(detectPersistentPreference("Never use Jade or Alexa for Anthony", therapists, students)).toBeNull();
  });
});
