import { getDb } from "@/lib/db/client";
import type { NotifyMode, ParentStatus, Plan, PlanAssignment, PlanKind, PlanStatus, PlanStep } from "@/lib/types";

interface PlanRow {
  id: number;
  date: string;
  kind: PlanKind;
  status: PlanStatus;
  parent_plan_id: number | null;
  notify_mode: NotifyMode | null;
  created_by: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

interface AssignmentRow {
  id: number;
  plan_id: number;
  session_id: number;
  slot: PlanAssignment["slot"];
  start_time: string;
  end_time: string;
  location: PlanAssignment["location"];
  student_id: number;
  student_name: string;
  student_plan: PlanAssignment["studentPlan"];
  from_therapist_id: number | null;
  from_therapist_name: string | null;
  to_therapist_id: number | null;
  to_therapist_name: string | null;
  step: PlanStep;
  distance_km: number | null;
  rationale: string;
  chain_id: string | null;
  edited_by_admin: number;
  rejected_therapist_ids: string;
  history: string;
  parent_status: ParentStatus;
  parent_responded_at: string | null;
}

const ASSIGNMENT_SELECT = `
  SELECT pa.*, se.slot, se.start_time, se.end_time, se.location, se.student_id,
         st.name AS student_name, st.plan AS student_plan,
         ft.name AS from_therapist_name, tt.name AS to_therapist_name
  FROM plan_assignments pa
  JOIN sessions se ON se.id = pa.session_id
  JOIN students st ON st.id = se.student_id
  LEFT JOIN therapists ft ON ft.id = pa.from_therapist_id
  LEFT JOIN therapists tt ON tt.id = pa.to_therapist_id`;

const toAssignment = (r: AssignmentRow): PlanAssignment => ({
  id: r.id,
  planId: r.plan_id,
  sessionId: r.session_id,
  slot: r.slot,
  startTime: r.start_time,
  endTime: r.end_time,
  location: r.location,
  studentId: r.student_id,
  studentName: r.student_name,
  studentPlan: r.student_plan,
  fromTherapistId: r.from_therapist_id,
  fromTherapistName: r.from_therapist_name,
  toTherapistId: r.to_therapist_id,
  toTherapistName: r.to_therapist_name,
  step: r.step,
  distanceKm: r.distance_km,
  rationale: JSON.parse(r.rationale) as string[],
  chainId: r.chain_id,
  editedByAdmin: r.edited_by_admin === 1,
  rejectedTherapistIds: JSON.parse(r.rejected_therapist_ids) as number[],
  canUndo: (JSON.parse(r.history) as unknown[]).length > 0,
  parentStatus: r.parent_status,
  parentRespondedAt: r.parent_responded_at,
});

const toPlan = (r: PlanRow): Omit<Plan, "issues"> => ({
  id: r.id,
  date: r.date,
  kind: r.kind,
  status: r.status,
  parentPlanId: r.parent_plan_id,
  notifyMode: r.notify_mode,
  createdBy: r.created_by,
  createdAt: r.created_at,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at,
  assignments: listAssignments(r.id),
});

export function listAssignments(planId: number): PlanAssignment[] {
  const rows = getDb()
    .prepare(`${ASSIGNMENT_SELECT} WHERE pa.plan_id = ? ORDER BY se.slot, st.name`)
    .all(planId) as AssignmentRow[];
  return rows.map(toAssignment);
}

export function getAssignment(id: number): PlanAssignment | null {
  const row = getDb().prepare(`${ASSIGNMENT_SELECT} WHERE pa.id = ?`).get(id) as AssignmentRow | undefined;
  return row ? toAssignment(row) : null;
}

export function listPlansByDate(date: string): Omit<Plan, "issues">[] {
  const rows = getDb().prepare("SELECT * FROM plans WHERE date = ? ORDER BY id DESC").all(date) as PlanRow[];
  return rows.map(toPlan);
}

export function getPlan(id: number): Omit<Plan, "issues"> | null {
  const row = getDb().prepare("SELECT * FROM plans WHERE id = ?").get(id) as PlanRow | undefined;
  return row ? toPlan(row) : null;
}

export function createPlan(input: { date: string; kind: PlanKind; parentPlanId: number | null; createdBy: string }): number {
  const r = getDb()
    .prepare("INSERT INTO plans (date, kind, parent_plan_id, created_by) VALUES (?, ?, ?, ?)")
    .run(input.date, input.kind, input.parentPlanId, input.createdBy);
  return Number(r.lastInsertRowid);
}

export function createAssignment(input: {
  planId: number;
  sessionId: number;
  fromTherapistId: number | null;
  toTherapistId: number | null;
  step: PlanStep;
  distanceKm: number | null;
  rationale: string[];
  chainId: string | null;
}): number {
  const r = getDb()
    .prepare(
      `INSERT INTO plan_assignments
       (plan_id, session_id, from_therapist_id, to_therapist_id, step, distance_km, rationale, chain_id, parent_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.planId,
      input.sessionId,
      input.fromTherapistId,
      input.toTherapistId,
      input.step,
      input.distanceKm,
      JSON.stringify(input.rationale),
      input.chainId,
      input.toTherapistId === null ? "not_required" : "pending",
    );
  return Number(r.lastInsertRowid);
}

export function updateAssignmentTarget(
  id: number,
  input: { toTherapistId: number | null; step: PlanStep; distanceKm: number | null; rationale: string[] },
) {
  getDb()
    .prepare(
      `UPDATE plan_assignments SET to_therapist_id = ?, step = ?, distance_km = ?, rationale = ?, edited_by_admin = 1,
       chain_id = NULL, parent_status = ? WHERE id = ?`,
    )
    .run(
      input.toTherapistId,
      input.step,
      input.distanceKm,
      JSON.stringify(input.rationale),
      input.toTherapistId === null ? "not_required" : "pending",
      id,
    );
}

/** A row's state before a row-level reject, so it can be restored by "Undo". */
export interface AssignmentSnapshot {
  toTherapistId: number | null;
  step: PlanStep;
  distanceKm: number | null;
  rationale: string[];
  editedByAdmin: boolean;
  rejectedTherapistIds: number[];
}

export function getAssignmentHistory(id: number): AssignmentSnapshot[] {
  const row = getDb().prepare("SELECT history FROM plan_assignments WHERE id = ?").get(id) as { history: string } | undefined;
  return row ? (JSON.parse(row.history) as AssignmentSnapshot[]) : [];
}

/** Overwrites a row's proposal + reject bookkeeping (used by row reject / undo). */
export function setAssignmentState(id: number, s: AssignmentSnapshot & { history: AssignmentSnapshot[] }) {
  getDb()
    .prepare(
      `UPDATE plan_assignments SET to_therapist_id = ?, step = ?, distance_km = ?, rationale = ?, edited_by_admin = ?,
       rejected_therapist_ids = ?, history = ?, chain_id = NULL, parent_status = ? WHERE id = ?`,
    )
    .run(
      s.toTherapistId,
      s.step,
      s.distanceKm,
      JSON.stringify(s.rationale),
      s.editedByAdmin ? 1 : 0,
      JSON.stringify(s.rejectedTherapistIds),
      JSON.stringify(s.history),
      s.toTherapistId === null ? "not_required" : "pending",
      id,
    );
}

export function setRejectedTherapists(id: number, ids: number[]) {
  getDb().prepare("UPDATE plan_assignments SET rejected_therapist_ids = ? WHERE id = ?").run(JSON.stringify(ids), id);
}

export function setPlanStatus(id: number, status: PlanStatus, decidedBy: string, notifyMode: NotifyMode | null = null) {
  getDb()
    .prepare("UPDATE plans SET status = ?, decided_by = ?, decided_at = datetime('now'), notify_mode = ? WHERE id = ?")
    .run(status, decidedBy, notifyMode, id);
}

/** Marks all still-draft plans for a date as superseded. Returns their ids. */
export function supersedeDrafts(date: string, exceptIds: number[] = []): number[] {
  const rows = getDb().prepare("SELECT id FROM plans WHERE date = ? AND status = 'draft'").all(date) as { id: number }[];
  const ids = rows.map((r) => r.id).filter((id) => !exceptIds.includes(id));
  const stmt = getDb().prepare("UPDATE plans SET status = 'superseded', decided_at = datetime('now') WHERE id = ?");
  for (const id of ids) stmt.run(id);
  return ids;
}

export function setParentStatus(id: number, status: ParentStatus) {
  getDb()
    .prepare("UPDATE plan_assignments SET parent_status = ?, parent_responded_at = datetime('now') WHERE id = ?")
    .run(status, id);
}

/** Approved changes still waiting for the parent, with their session's date and start time. */
export function listPendingParentAssignments(): { id: number; date: string; startTime: string }[] {
  return getDb()
    .prepare(
      `SELECT pa.id, se.date, se.start_time AS startTime FROM plan_assignments pa
       JOIN plans p ON p.id = pa.plan_id JOIN sessions se ON se.id = pa.session_id
       WHERE p.status = 'approved' AND pa.parent_status = 'pending'`,
    )
    .all() as { id: number; date: string; startTime: string }[];
}

export function addExclusion(sessionId: number, therapistId: number) {
  getDb().prepare("INSERT OR IGNORE INTO assignment_exclusions (session_id, therapist_id) VALUES (?, ?)").run(sessionId, therapistId);
}

export function listExclusions(date: string): Map<number, Set<number>> {
  const rows = getDb()
    .prepare(
      `SELECT ae.session_id, ae.therapist_id FROM assignment_exclusions ae
       JOIN sessions se ON se.id = ae.session_id WHERE se.date = ?`,
    )
    .all(date) as { session_id: number; therapist_id: number }[];
  const out = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!out.has(r.session_id)) out.set(r.session_id, new Set());
    out.get(r.session_id)!.add(r.therapist_id);
  }
  return out;
}
