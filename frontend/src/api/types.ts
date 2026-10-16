// MIRROR of backend/src/lib/types.ts — the backend file is the source of truth.
// When an API shape changes, update the backend file first, then copy the change here.

/** SBT = Senior Behavior Therapist, LBT = Lead Behavior Therapist (both "senior");
 *  BT = Behavior Therapist, PT = Program Therapist (both "junior"). */
export type Rank = "SBT" | "LBT" | "BT" | "PT";
export const SENIOR_RANKS: readonly Rank[] = ["SBT", "LBT"];

export type Slot = "AM" | "PM";
/** Home and school (shadow) sessions can only be run by the child's designated therapist. */
export type Location = "clinic" | "home" | "school";
export type SessionStatus = "scheduled" | "cancelled";
/** "off" = rostered off (e.g. a part-timer's non-working slot), not a disruption. */
export type AbsenceType = "annual" | "medical" | "urgent" | "off" | "other";
export type ReallocationStatus = "proposed" | "approved" | "rejected";

export interface Therapist {
  id: number;
  name: string;
  rank: Rank;
  isPartTime: boolean;
  homeArea: string | null;
}

export interface Student {
  id: number;
  name: string;
  /** Case complexity from the case allocation sheet, if known. */
  plan: "Core" | "Advanced" | "Specialised" | null;
  /** Therapist ids on the child's team (familiarity). */
  teamTherapistIds: number[];
}

export interface Session {
  id: number;
  date: string; // YYYY-MM-DD
  slot: Slot;
  startTime: string; // HH:MM (24h)
  endTime: string;
  location: Location;
  status: SessionStatus;
  studentId: number;
  studentName: string;
  therapistId: number | null;
  therapistName: string | null;
  /** Set once a session has been reassigned, so we can always show who it originally belonged to. */
  originalTherapistId: number | null;
  cancelReason: string | null;
}

export interface Absence {
  id: number;
  therapistId: number;
  therapistName: string;
  date: string;
  /** null = whole day */
  slot: Slot | null;
  type: AbsenceType;
  note: string | null;
  reportedAt: string;
}

export interface Reallocation {
  id: number;
  sessionId: number;
  date: string;
  slot: Slot;
  studentName: string;
  fromTherapistId: number | null;
  fromTherapistName: string | null;
  /** null = proposal is to cancel the session */
  toTherapistId: number | null;
  toTherapistName: string | null;
  score: number | null;
  /** Human-readable reasons, e.g. ["On child's team", "Senior → senior"]. Required for traceability. */
  rationale: string[];
  status: ReallocationStatus;
  proposedBy: string;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: unknown;
  createdAt: string;
}
