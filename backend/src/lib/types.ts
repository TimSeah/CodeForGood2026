// Domain types shared across the backend. This file is the source of truth for API shapes —
// frontend/src/api/types.ts mirrors it, so update both together.

/** SBT = Senior Behavior Therapist, LBT = Lead Behavior Therapist (both "senior");
 *  BT = Behavior Therapist, PT = Program Therapist (both "junior"). */
export type Rank = "SBT" | "LBT" | "BT" | "PT";
export const SENIOR_RANKS: readonly Rank[] = ["SBT", "LBT"];

/** Core → juniors only, Advanced → mix, Specialised → seniors only. */
export type CasePlan = "Core" | "Advanced" | "Specialised";

export type Slot = "AM" | "PM";
export type Location = "clinic" | "home" | "school";
export type SessionStatus = "scheduled" | "cancelled";
/** "off" = rostered off (e.g. a part-timer's non-working slot), not a disruption. */
export type AbsenceType = "annual" | "medical" | "urgent" | "off" | "other";

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
  plan: CasePlan | null;
  homeArea: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  /** Therapist ids on the child's team (familiarity). */
  teamTherapistIds: number[];
  /** Therapists the parents are not comfortable with — last resort only. */
  blacklistTherapistIds: number[];
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
  /** Parent acceptance of the latest approved change to this session (null = never changed). */
  parentStatus: ParentStatus | null;
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
  botReportId: number | null;
}

// ---- WhatsApp intake ------------------------------------------------------------------------

export type BotRole = "therapist" | "patient";
export type BotDayPart = "whole day" | "morning" | "afternoon";
export type BotReportStatus = "ingested" | "unmatched" | "ignored";

/** A report collected by the WhatsApp bot (bot/), copied into the backend. */
export interface BotReport {
  id: number;
  role: BotRole;
  name: string; // as typed by the reporter
  phone: string | null;
  startDate: string;
  endDate: string;
  dayPart: BotDayPart;
  mcAttached: boolean;
  reportedAt: string;
  status: BotReportStatus;
  matchedTherapistId: number | null;
  matchedStudentId: number | null;
  /** Roster name it was matched to. */
  matchedName: string | null;
  /** Number of sessions impacted (therapist: sessions needing cover; patient: sessions cancelled). */
  affectedSessions: number;
}

// ---- Plans (tentative schedules) --------------------------------------------------------------

export type PlanKind = "primary" | "swap_alternative" | "replan";
export type PlanStatus = "draft" | "approved" | "rejected" | "superseded";
export type NotifyMode = "whatsapp" | "manual";
/** Which matching rule picked the therapist (see docs/plans/rescheduling.md). */
export type PlanStep = "team" | "tier" | "history" | "any" | "blacklisted" | "swap" | "cancel" | "manual";
export type ParentStatus = "pending" | "accepted" | "declined" | "expired" | "not_required";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  assignmentId?: number;
}

export interface PlanAssignment {
  id: number;
  planId: number;
  sessionId: number;
  slot: Slot;
  startTime: string;
  endTime: string;
  location: Location;
  studentId: number;
  studentName: string;
  studentPlan: CasePlan | null;
  fromTherapistId: number | null;
  fromTherapistName: string | null;
  /** null = cancel the session */
  toTherapistId: number | null;
  toTherapistName: string | null;
  step: PlanStep;
  distanceKm: number | null;
  /** Human-readable reasons. Required for traceability. */
  rationale: string[];
  /** Moves that belong to the same swap chain share an id. */
  chainId: string | null;
  editedByAdmin: boolean;
  parentStatus: ParentStatus;
  parentRespondedAt: string | null;
}

/** A therapist option for one assignment, shown in the Approval page's edit dropdown. */
export interface AssignmentCandidate {
  therapistId: number;
  therapistName: string;
  rank: Rank;
  step: PlanStep;
  distanceKm: number | null;
  reasons: string[];
  available: boolean;
  /** Why they can't take it, e.g. "Away (medical)" or "Booked with Lola". */
  unavailableReason: string | null;
}

export interface Plan {
  id: number;
  date: string;
  kind: PlanKind;
  status: PlanStatus;
  parentPlanId: number | null;
  notifyMode: NotifyMode | null;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  assignments: PlanAssignment[];
  /** Validation result for drafts (errors block approval). */
  issues: ValidationIssue[];
}

// ---- Messaging ---------------------------------------------------------------------------------

export interface Notification {
  id: number;
  recipientType: "therapist" | "guardian" | "supervisor";
  recipientId: number | null;
  recipientName: string | null;
  toPhone: string | null;
  purpose: string;
  body: string;
  attachment: string | null;
  status: "pending" | "sent" | "failed" | "placeholder";
  planAssignmentId: number | null;
  createdAt: string;
}

// ---- Session logs ------------------------------------------------------------------------------

export type Attendance = "present" | "late" | "absent" | "cancelled";

export interface SessionLog {
  id: number;
  sessionId: number | null;
  date: string;
  slot: Slot;
  studentId: number;
  studentName: string;
  therapistId: number;
  therapistName: string;
  attendance: Attendance;
  /** Shareable with a substitute therapist. */
  summary: string | null;
  /** Private clinical notes. */
  notes: string | null;
  goals: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Monthly allocation (Schedule page) ----------------------------------------------------------

export interface PatternCell {
  off: boolean;
  startTime: string | null;
  endTime: string | null;
  studentName: string | null;
  location: Location;
}

export interface MonthlyPatternRow {
  therapistId: number;
  therapistName: string;
  rank: Rank;
  isPartTime: boolean;
  homeArea: string | null;
  /** One entry per slot; MWF / TT each hold the cells for that weekday group (usually 0 or 1). */
  slots: Record<Slot, { MWF: PatternCell[]; TT: PatternCell[] }>;
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
