# Scheduling preference memory (admin-confirmed)

The system notices repeated admin schedule changes, **asks** whether they are an ongoing preference, and applies
**only** the preferences an admin confirms. It is a structured, auditable store of rules. It does not train or
fine-tune any model, and an unconfirmed inference never acts as a rule.

## Flow

```
Approval page: admin changes a PROPOSED therapist ("Change" or row "Reject")
   │  must pick a reason: Not compatible with this child · This time doesn't work for the therapist ·
   │                      Someone else is a better fit · One-off (today only) · Other  (+ optional note)
   ▼
assignment_change_events  (one row per change: date, actual session start/end, child, therapist removed, reason)
   ▼  only the first two reasons are evidence; reason-less or other-reason changes are kept but never learned from
Pattern detection (pure: services/preferences/detect.ts)
   │  same therapist+child (pairing) or same therapist (time) on ≥ 3 SEPARATE DATES   (PREFERENCE_SUGGESTION_THRESHOLD)
   ▼
scheduling_preferences row, status = "suggested", with the evidence and a question, e.g.
   "I noticed Tara was replaced for Anthony on 3 separate dates (…) because they weren't compatible.
    Should I avoid this pairing in future schedules?"
   ▼  shown on the Approval page and the "Scheduling rules" tab — it does NOT affect scheduling
Admin: Yes, make it a rule… (chooses strength; for time rules the exact time, start/end, days, ongoing/until)
       or No, not a rule (never suggested again)
   ▼
status = "active"  → used by the engine, candidate lists, validation and the AI agent tools
Admin can later Edit · Pause · Resume · Remove. Every step is in the audit log.
```

An **AI agent instruction** that sounds lasting (e.g. "never…", "from now on…", "going forward…" plus a recognised
therapist and child, or a therapist and a time) is applied to that draft only. It also creates a **suggestion**
(`source = agent_prompt`) asking the admin whether to save it. Start vs end is never guessed.

## Preference types

| Type | Soft ("avoid") | Hard ("never") |
| --- | --- | --- |
| Therapist ↔ child | Avoid when another suitable therapist is free | Never assign this therapist to this child |
| Therapist time | Avoid giving them matching sessions | Unavailable for matching sessions |

A time rule has explicit **days** (0 = Sun … 6 = Sat, case-study calendar for July 2031), an exact **boundary**
(HH:MM, SGT) and what it applies to:

- `end`: sessions still **running after** the boundary (session end > boundary). For example, "not past 5 pm"
  catches 2:00–5:30 pm and 2:45–5:15 pm, but not a session that ends at exactly 5:00 pm.
- `start`: sessions **starting at or after** the boundary.

Sessions store real start and end times (e.g. 14:00–17:30, 14:15–16:45), so rules use those. The broad PM slot is
never treated as "5 pm". A time rule with missing days, time or start/end never applies, and can't be confirmed.

Each preference stores type, scope (therapist, child), strength, status, source (pattern / admin /
agent_prompt), confirming admin and time, reason, effective dates (`effective_to = NULL` → ongoing), the question
asked, the agent prompt (if any), and supporting evidence (change-event ids, expanded in the API).

## How confirmed preferences apply

Engine costs per slot are lexicographic: **cancellations ≫ soft-preference conflicts ≫ existing ranking (team → tier →
history → any → blacklisted) ≫ distance**.

- **Hard** rule: the candidate is excluded from proposals, shown as unavailable in the "Change" list
  (`Rule #n (never): …`), and assigning them by hand is a **validation error** (approval is blocked).
- **Soft** rule: considered after minimising cancellations and before team/tier/history/distance. A session is
  **never cancelled** just to satisfy a soft rule. When one has to be overridden, the rationale says
  `⚠ Overrides Rule #n (avoid): … no other suitable therapist was free, and cancelling is worse`, and validation shows a
  warning.
- Rationale lines also say which candidates a rule kept out (`… — Tara not considered` / `… avoided`).
- Swap alternatives never create a conflict with a confirmed rule.
- The **blacklist is unchanged**. It still means "last resort", and is not used to represent a hard incompatibility.
- Every plan still needs admin approval. Preference changes apply to new drafts and re-validate open drafts. Use
  "Re-run engine" to re-draft.
- No WhatsApp messages are sent by this feature.

## Suggestion rules

- Counts **distinct dates**, not edits.
- A suggestion that is already open is refreshed with new evidence instead of being duplicated.
- **Rejected** ("not a rule") is never suggested again. **Active / paused** rules aren't suggested.
- After a rule is **removed**, only changes recorded after the removal can lead to a new suggestion.

## Data model (migration 004)

- `assignment_change_events`: evidence (plan, assignment, session, date, actual start/end, child, removed and new
  therapist, action edited/rejected, reason code + note, actor).
- `scheduling_preferences`: suggestions and rules (status `suggested | active | paused | rejected | removed`).

## Limitations

- Weekdays for time rules use the case-study calendar for July 2031 (3 July = Monday) and the real calendar
  otherwise, the same as the frontend.
- Rules affect **replacement** choices (draft plans). They don't move a therapist off their own regular
  (pattern) sessions. That would be a roster change.
- Agent-prompt detection is keyword- and name-based. It only *suggests*, and skips ambiguous names (e.g. a name
  that is both a therapist and a child).
- No auth: "confirmed by" is the `actor` the client sends (default `admin`), as elsewhere in this prototype.

## Where things live

| Area | Backend | Frontend |
| --- | --- | --- |
| Matching (pure) | `services/reallocation/preferences.ts` (+ engine, candidates, validate, swaps) | |
| Detection (pure) | `services/preferences/detect.ts`, `agent-intent.ts` | |
| Service + audit | `services/preferences/index.ts`, `repositories/{preferences,change-events}.ts` | |
| API | `api/preferences/*`; reason on `PATCH /api/plans/:id/assignments/:aid` and `…/reject` | `features/preferences/*` |
| UI | | Approval page: reason picker, `SuggestionsPanel`; `/preferences` "Scheduling rules" tab |
