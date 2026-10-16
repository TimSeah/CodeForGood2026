import type { QueryClient } from "@tanstack/react-query";

/**
 * Most writes (an absence, a report, an approval, a parent reply) ripple through the whole day:
 * plans are regenerated, sessions change, messages are queued. Refetch all day-scoped data.
 */
export function invalidateDayData(qc: QueryClient) {
  for (const key of [
    "plans",
    "sessions",
    "confirmed-sessions",
    "absences",
    "bot-reports",
    "notifications",
    "audit",
    "person-month",
    "preferences",
  ]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
