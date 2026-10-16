import { z } from "zod";

// Request schemas for API routes. Validate every body/query with one of these before using it.

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const slot = z.enum(["AM", "PM"]);

/** No auth in this local prototype — callers just say who they are, and it goes in the audit log. */
const actor = z.string().min(1).default("admin");

export const dateQuery = z.object({ date: isoDate });

export const createAbsenceBody = z.object({
  therapistId: z.number().int().positive(),
  date: isoDate,
  slot: slot.nullable().default(null),
  type: z.enum(["annual", "medical", "urgent", "off", "other"]),
  note: z.string().max(500).optional(),
  actor,
});
export type CreateAbsenceBody = z.infer<typeof createAbsenceBody>;

export const proposeBody = z.object({ date: isoDate, actor });

export const decideReallocationBody = z.object({
  status: z.enum(["approved", "rejected"]),
  actor,
});

export const idParam = z.coerce.number().int().positive();

export const auditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });
