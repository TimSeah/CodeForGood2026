# Plan: rescheduling, approval, WhatsApp hand-off, session logs

Status: implemented on branch `feat-reschedule` (see "Where things live"). Decisions below were agreed with the
product owner on 16 Oct 2026. Treat them as requirements unless the team changes them.

## End-to-end flow

```
WhatsApp bot (bot/, separate SQLite)
   │  role=therapist|patient, name, start/end date, day_part, MC flag
   ▼
Backend intake  (POST /api/intake/sync, also polled by the Disruptions page every 30 s)
   │  name → roster match (case-insensitive). Unmatched → shown on the Disruptions page for the admin to map.
   │  therapist report → absences rows;  patient report → that child's sessions cancelled (frees the therapist)
   ▼
Engine auto-runs for every affected date → DRAFT plan (+ optional SWAP ALTERNATIVE plan)
   ▼
Approval page: admin reviews the tentative day schedule + per-person monthly calendars, edits assignments
   │  every edit is validated (hard errors block approval; soft warnings are shown)
   ▼
Approve → dialog "Send automated WhatsApp messages?"
   ├─ Yes → parent gets "accept/decline" message (deadline = session start − 15 min);
   │        substitute therapist gets an info message + summary of child's last session + PDF of that log
   └─ No  → nothing is sent; admin marks parent accepted/declined manually in the portal
   ▼
Parent response (bot → POST /api/whatsapp/responses, or manual tick)
   ├─ accepted → confirmed
   ├─ declined → parent gets "please call the centre" message; session goes back to "needs cover" with that
   │             therapist excluded; engine re-runs → new draft for admin to approve
   └─ no answer by start − 15 min → session cancelled, therapist told not to go
```

Therapists are **informed only**; they cannot decline.

## Rule engine or AI scheduling agent

The Approval page can re-draft a date in either mode through the same `POST /api/plans/generate` endpoint:

- **Rule-based logic** is the deterministic optimiser described below (`{ date, mode: "rules" }`).
- **AI scheduling agent** starts from that safe rule-based draft, accepts an admin instruction, and uses function
  tools to read the draft, list candidates, change assignments, and validate the result
  (`{ date, mode: "agent", prompt }`).

Both paths reuse the same candidate ranking and validation modules. The agent works in memory and its changes are
only written after the validator finds no hard conflicts; the resulting plan still requires admin approval. Set
`OPENAI_API_KEY` in the backend environment to enable agent mode. `OPENAI_MODEL` is optional and defaults to
`gpt-5-mini`.

## Matching rules (engine)

For each session whose therapist is absent in that slot, candidates are therapists who are working (not absent,
not rostered off) and not already booked in that slot. Candidates are ranked by **step**, then by **distance**
(therapist home area → child home area, straight-line km), then by name:

| Step | Rule |
| --- | --- |
| 1 Team | On the child's team |
| 2 Tier | Rank fits the child's plan: **Core** → junior (BT/PT), **Specialised** → senior (SBT/LBT), **Advanced** → either |
| 3 History | Has covered this child before (session logs, or past reassigned sessions) |
| 4 Any | Anyone else who is free |
| 5 Blacklisted | Therapist on the child's blacklist (parents uncomfortable). Always last, but better than cancelling |

- Cancel only when **nobody** is free in that slot.
- Home/school sessions: controlled by `ENGINE_CONFIG.designatedOnlyForHomeSchool` (default **false**, i.e. they
  are reassignable until the organisation confirms otherwise; set to `true` to restore "designated therapist only").
- Each slot (AM / PM) is solved as an optimal assignment (Hungarian algorithm, `hungarian.ts`): first
  **minimise cancellations**, then follow the rule order across *all* children (so one child can't take a
  therapist via a weaker rule that another child needed via a stronger one), then distance.
- Parent declines add (session, therapist) to an exclusion list for re-planning.

### Chain swaps (rare)

A → covers child B, B → covers child C. Never part of the main plan. Offered as a **separate alternative plan**
the admin can choose instead, and **only if it avoids a cancellation** (`ENGINE_CONFIG.swapTrigger = "cancellation"`).

> When do swaps actually help? A cancellation normally means more children need cover than there are free
> therapists, and a swap doesn't add capacity. They help when a free therapist **can't** take a particular
> child, which today means the parent declined them. Example from the demo: Anthony's parent declines Jade →
> Jade is excluded for Anthony → the alternative plan moves Valentina from Benedict to Anthony and Jade to Benedict.
> Set `swapTrigger = "fallback"` to also offer swaps that replace an out-of-tier or blacklisted match.

## Data model changes (migration 002)

- `students`: `home_area`, `guardian_name`, `guardian_phone`, `plan` (mock plans derived from team seniority)
- `student_blacklist(student_id, therapist_id, reason)`
- `weekly_patterns`: the monthly MWF/TT allocation (from Case-Allocation.xlsx) shown on the Schedule page
- `bot_reports`: copies of bot `absences` rows plus the roster match and ingest status
- `plans` (draft / approved / rejected / superseded; kind primary / swap_alternative / replan) and
  `plan_assignments` (one row per changed session: from → to, step, distance, rationale, parent acceptance state)
- `session_logs`: attendance, shareable summary, private notes, goals; used for "history" in the engine
- `reallocations` is replaced by `plans` + `plan_assignments`

## WhatsApp integration (placeholder)

The bot can't send messages yet. It only replies to inbound messages and has no HTTP API apart from `/webhook`.
The backend has a `WhatsAppGateway` interface (`backend/src/lib/services/whatsapp/`). Today a placeholder
implementation writes every outgoing message to the `notifications` table (visible on the Approval page) and logs
it. **TODO (bot team):** expose a send endpoint (with template support for proactive messages, plus document
upload for the PDF), set `BOT_API_URL`, and call `POST /api/whatsapp/responses` when a parent replies.

Meta's rules need **pre-approved templates** for messages sent outside the 24-hour window, which covers all of
these proactive messages.

## Where things live

| Area | Backend | Frontend |
| --- | --- | --- |
| Intake | `services/intake.ts`, `api/intake/*` | `features/absences/BotReportsPanel.tsx` |
| Engine | `services/reallocation/{engine,swaps,ranking,distance}.ts` | |
| Plans/approval | `services/plans.ts`, `services/rescheduling-agent.ts`, `api/plans/*` | `features/approval/*` |
| Messaging | `services/whatsapp/*`, `services/acceptance.ts` | Approval page outbox |
| Session logs | `repositories/session-logs.ts`, `api/session-logs/*` (+ PDF) | `features/logs/*` |
| Schedule | `api/schedule/monthly` | `features/schedule/*` (Monthly + Daily tabs) |
