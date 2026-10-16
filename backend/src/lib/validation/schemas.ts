import { z } from "zod";

// Request schemas for API routes. Validate every body/query with one of these before using it.

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const isoMonth = z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM");
export const slot = z.enum(["AM", "PM"]);
const id = z.coerce.number().int().positive();

/** No auth in this local prototype — callers just say who they are, and it goes in the audit log. */
const actor = z.string().min(1).default("admin");

export const idParam = id;
export const dateQuery = z.object({ date: isoDate });

export const sessionsQuery = z.union([
  z.object({ date: isoDate }),
  z.object({ month: isoMonth, therapistId: id.optional(), studentId: id.optional() }),
]);

export const createAbsenceBody = z.object({
  therapistId: z.number().int().positive(),
  date: isoDate,
  slot: slot.nullable().default(null),
  type: z.enum(["annual", "medical", "urgent", "off", "other"]),
  note: z.string().max(500).optional(),
  actor,
});
export type CreateAbsenceBody = z.infer<typeof createAbsenceBody>;

// ---- intake ----
export const simulateReportBody = z
  .object({
    role: z.enum(["therapist", "patient"]),
    name: z.string().trim().min(1).max(100),
    phone: z.string().max(30).nullable().optional(),
    startDate: isoDate,
    endDate: isoDate,
    dayPart: z.enum(["whole day", "morning", "afternoon"]),
    mcAttached: z.boolean().default(false),
    actor,
  })
  .refine((b) => b.endDate >= b.startDate, { message: "endDate must not be before startDate", path: ["endDate"] });

export const resolveReportBody = z.union([
  z.object({ therapistId: id, actor }),
  z.object({ studentId: id, actor }),
  z.object({ ignore: z.literal(true), actor }),
]);

// ---- plans ----
export const generatePlanBody = z
  .object({
    date: isoDate,
    mode: z.enum(["rules", "agent"]).default("rules"),
    prompt: z.string().trim().max(2000).optional(),
    actor,
  })
  .superRefine((body, ctx) => {
    if (body.mode === "agent" && !body.prompt) {
      ctx.addIssue({ code: "custom", path: ["prompt"], message: "A prompt is required in AI agent mode" });
    }
  });
export const approvePlanBody = z.object({ notifyMode: z.enum(["whatsapp", "manual"]), actor });
export const actorBody = z.object({ actor });
/** Why the admin moved a proposed therapist off a session (evidence for the preference memory). */
export const changeReason = z.object({
  code: z.enum(["child_incompatible", "therapist_time_unavailable", "better_fit", "one_off", "other"]),
  note: z.string().trim().max(500).nullable().optional(),
});
export const editAssignmentBody = z.object({
  toTherapistId: z.number().int().positive().nullable(),
  reason: changeReason.nullable().optional(),
  actor,
});
export const rejectAssignmentBody = z.object({ reason: changeReason.nullable().optional(), actor });
export const expireBody = z.object({ now: z.iso.datetime({ offset: true }).optional() });

export const parentResponseBody = z.object({ response: z.enum(["accepted", "declined"]), actor });
export const therapistPhoneBody = z.object({ phone: z.string().regex(/^\+?\d{8,15}$/).nullable(), actor });
export const guardianPhoneBody = therapistPhoneBody;

/** What the WhatsApp bot posts when a parent replies. It may only know the phone number. */
export const whatsappResponseBody = z
  .object({
    assignmentId: id.optional(),
    phone: z.string().min(8).max(30),
    messageId: z.string().min(1).max(255),
    response: z.enum(["accepted", "declined", "yes", "no"]),
  });
export const whatsappDeliveryBody = z.object({
  status: z.enum(["sent", "delivered", "read", "failed"]),
  messageId: z.string().min(1).max(255).nullable().default(null),
  error: z.string().max(500).nullable().default(null),
});

// ---- session logs ----
const sessionLogFields = {
  sessionId: id.nullable().default(null),
  date: isoDate,
  slot,
  studentId: id,
  therapistId: id,
  attendance: z.enum(["present", "late", "absent", "cancelled"]),
  summary: z.string().max(2000).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  goals: z.string().max(2000).nullable().default(null),
};
export const createSessionLogBody = z.object({ ...sessionLogFields, actor });
export const updateSessionLogBody = z.object({
  sessionId: id.nullable().optional(),
  date: isoDate.optional(),
  slot: slot.optional(),
  studentId: id.optional(),
  therapistId: id.optional(),
  attendance: sessionLogFields.attendance.optional(),
  summary: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  goals: z.string().max(2000).nullable().optional(),
  actor,
});
export const sessionLogQuery = z.object({
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  studentId: id.optional(),
  therapistId: id.optional(),
});

// ---- session video review ----
export const createVideoReviewBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]),
  sizeBytes: z.number().int().positive().max(1_073_741_824, "Video must be 1 GB or smaller"),
  actor,
});
export const processVideoReviewBody = z.object({ actor });

// ---- scheduling preferences ----
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24h)");
const preferenceFields = {
  strength: z.enum(["soft", "hard"]),
  /** 0 = Sun … 6 = Sat */
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().optional(),
  boundaryTime: hhmm.nullable().optional(),
  appliesTo: z.enum(["start", "end"]).nullable().optional(),
  ongoing: z.boolean().optional(),
  effectiveFrom: isoDate.nullable().optional(),
  effectiveTo: isoDate.nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
};
export const preferenceQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined))
    .pipe(z.array(z.enum(["suggested", "active", "paused", "rejected", "removed"])).optional()),
});
export const createPreferenceBody = z
  .object({
    type: z.enum(["pairing", "time_unavailable"]),
    therapistId: z.number().int().positive(),
    studentId: z.number().int().positive().nullable().optional(),
    ...preferenceFields,
    actor,
  })
  .refine((b) => b.type !== "pairing" || b.studentId, { message: "A pairing rule needs a child", path: ["studentId"] });
export const confirmPreferenceBody = z.object({ ...preferenceFields, actor });
export const editPreferenceBody = z.object({ ...preferenceFields, actor });
export const rejectPreferenceBody = z.object({ reason: z.string().trim().max(500).nullable().optional(), actor });

export const monthQuery = z.object({ month: isoMonth });
export const auditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });
