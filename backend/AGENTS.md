# backend/AGENTS.md

Next.js 16 (App Router) used **only as an API server** on port 3001. SQLite via `better-sqlite3`
(synchronous, no ORM). Validation with `zod` v4. Tests with `vitest`. PDFs with `pdf-lib`.
Read the root `AGENTS.md` and `docs/plans/rescheduling.md` first.

## Folder structure

```
backend/
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx        Placeholder page only. Do not build UI here — UI lives in ../frontend.
│   │   └── api/<resource>/route.ts     HTTP layer. Thin: parse → call service/repository → ok(...)
│   └── lib/
│       ├── types.ts                    Domain + API types. SOURCE OF TRUTH for the API contract.
│       ├── http.ts                     ok(), fail(), handle(), HttpError, queryOf()
│       ├── dates.ts                    Date-range + parent-deadline helpers (no weekday maths — fictional calendar)
│       ├── validation/schemas.ts       zod schemas for every request body / query
│       ├── db/
│       │   ├── client.ts               getDb(): the single connection (auto-runs migrations)
│       │   ├── migrate.ts              Migration runner
│       │   ├── migrations/NNN_*.sql    Schema, one file per change, applied in order
│       │   ├── seed.ts                 Base data (therapists, children, patterns, sessions, past logs)
│       │   ├── seed-data.ts            AUTO-GENERATED from docs/data/Case-Allocation.xlsx
│       │   └── seed-mock.ts            Hand-written mock data (child areas, guardians, blacklist, past covers)
│       ├── repositories/<entity>.ts    ALL SQL lives here. Row → domain mapping (snake_case → camelCase)
│       └── services/                   Business logic + transactions + audit logging
│           ├── intake.ts               WhatsApp bot reports → absences / child cancellations → auto re-plan
│           ├── plans.ts                Generate / edit / validate / approve / reject plans; candidate lists
│           ├── acceptance.ts           Parent accept/decline, 15-min deadline expiry, re-plan on decline
│           ├── session-logs.ts         Session log CRUD + single-session PDF
│           ├── absences.ts             Admin-entered absences
│           ├── demo-scenario.ts        Loads the Case-Scenario.docx disruption (used by db:reset)
│           ├── whatsapp/
│           │   ├── gateway.ts          WhatsAppGateway interface + PLACEHOLDER (writes to notifications outbox)
│           │   └── messages.ts         Message wording
│           └── reallocation/           The engine. PURE except context.ts
│               ├── engine.ts           Optimal assignment per slot → primary plan
│               ├── ranking.ts          Rule order (team → tier → history → any → blacklisted) + ENGINE_CONFIG
│               ├── hungarian.ts        Min-cost assignment solver
│               ├── swaps.ts            Chain-swap alternative plan
│               ├── validate.ts         Validation of (edited) plans: errors block approval, warnings inform
│               ├── availability.ts     Absent / busy / affected helpers
│               ├── distance.ts         Singapore area centroids → km
│               ├── context.ts          Loads one date's data for the pure functions (only DB-touching file here)
│               └── engine.test.ts
├── scripts/                            CLI scripts run with tsx (db:migrate, db:seed, db:reset, propose)
└── data/app.db                         SQLite file (git-ignored)
```

## Layering rules (important)

```
route.ts  →  services/*  →  repositories/*  →  getDb()
                ↓
         services/reallocation/* (pure: engine, ranking, swaps, validate)
```

- **Routes** never contain SQL or business logic. Always wrap handlers in `handle(...)` and return `ok(...)`.
  Validate every input with a schema from `validation/schemas.ts`.
- **Repositories** are the only place that call `getDb()` or write SQL. Use `?` placeholders — never string-concat
  user input into SQL. Return domain types from `types.ts`, not raw rows.
- **Services** coordinate multiple repositories, wrap multi-step writes in `getDb().transaction(...)`, and call
  `logAudit(...)` for every state change. Throw `HttpError(status, message)` for expected failures (404, 409…).
- **The engine is pure.** `engine.ts`, `ranking.ts`, `swaps.ts`, `validate.ts` take plain data and return plain
  data. Only `context.ts` loads from the DB. Keep it that way: it's what makes the rules unit-testable.
- **Messages go through `getWhatsAppGateway()`**, never straight to an HTTP API, so the placeholder can be swapped.
- Simple read-only routes may call a repository directly (see `api/therapists/route.ts`).

## Recipes

**Add an endpoint** (e.g. `GET /api/things`):
1. Types in `lib/types.ts` (and mirror into `frontend/src/api/types.ts`).
2. Queries in `lib/repositories/things.ts`.
3. Logic/audit in `lib/services/things.ts` if it writes or combines data.
4. Schema in `lib/validation/schemas.ts`.
5. `src/app/api/things/route.ts` exporting `GET`/`POST` = `handle(...)`.
   Dynamic segments: `ctx: { params: Promise<{ id: string }> }` — params are a Promise in Next 16; `await` them.

**Change the schema:** add `src/lib/db/migrations/00N_description.sql`. Never edit an existing migration.
Update the affected repository + types, then `npm run db:reset`.

**Change matching behaviour:** rule order / tiers → `ranking.ts`; costs and constraints → `engine.ts`;
toggles → `ENGINE_CONFIG` in `ranking.ts`. Add a test in `engine.test.ts` for any rule you add. Run
`npm run propose` to see the effect on the 11 July 2031 scenario.

**Connect the real WhatsApp bot:** implement a gateway in `services/whatsapp/gateway.ts` (see the TODO there) and
have the bot call `POST /api/whatsapp/responses` when parents reply.

**Regenerate seed data** after the Excel changes:
`python scripts/generate_seed_data.py ../docs/data/Case-Allocation.xlsx > src/lib/db/seed-data.ts`

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Dev server on :3001 |
| `npm run typecheck` / `npm test` / `npm run build` | **Run all three before finishing a task** |
| `npm run db:reset` | Delete DB, migrate, seed base data + case scenario (stop the dev server first on Windows) |
| `npm run db:seed [-- --scenario]` | Re-seed without deleting the file |
| `npm run propose [-- 2031-07-11]` | Re-run the engine for a date and print the draft plan(s) |

## API (current)

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/health` | |
| GET | `/api/therapists`, `/api/students` | |
| GET | `/api/sessions` | `?date=` or `?month=YYYY-MM&therapistId=` / `&studentId=` |
| GET/POST | `/api/absences` | `?date=` / `{ therapistId, date, slot?, type, note? }` → re-plans the date |
| GET/POST | `/api/intake/reports` | `?date=` / `{ role, name, startDate, endDate, dayPart, mcAttached }` (manual/demo report) |
| PATCH | `/api/intake/reports/:id` | `{ therapistId }` \| `{ studentId }` \| `{ ignore: true }` — resolve an unmatched report |
| POST | `/api/intake/sync` | Pull new reports from the bot's SQLite DB |
| GET | `/api/plans` | `?date=` — newest first; drafts include `issues`; also expires overdue parent replies |
| POST | `/api/plans/generate` | `{ date }` — re-run the engine (supersedes older drafts, keeps admin edits) |
| GET | `/api/plans/:id` | |
| PATCH | `/api/plans/:id/assignments/:aid` | `{ toTherapistId \| null }` — admin edit, re-validated |
| GET | `/api/plans/:id/assignments/:aid/candidates` | Every therapist ranked, with availability |
| POST | `/api/plans/:id/approve` | `{ notifyMode: "whatsapp" \| "manual" }` — 409 + errors if invalid |
| POST | `/api/plans/:id/reject` | |
| POST | `/api/plans/expire` | `{ now? }` — run the 15-min deadline check (pass `now` to demo) |
| POST | `/api/assignments/:id/parent-response` | `{ response: "accepted" \| "declined" }` (admin) |
| POST | `/api/whatsapp/responses` | `{ assignmentId? \| phone?, response: yes/no/accepted/declined }` (for the bot) |
| GET | `/api/notifications` | `?date=` — WhatsApp outbox |
| GET/POST | `/api/session-logs` | `?date&from&to&studentId&therapistId` / `{ date, slot, studentId, therapistId, attendance, ... }` |
| GET/PATCH/DELETE | `/api/session-logs/:id` | |
| GET | `/api/session-logs/:id/pdf` | Single-session PDF (sent to substitutes) |
| GET | `/api/schedule/monthly` | `?month=YYYY-MM` — MWF/TT allocation table |
| GET | `/api/audit` | `?limit=100` |

## Gotchas

- `better-sqlite3` is a native module; it's listed in `serverExternalPackages` in `next.config.ts`. Keep it there.
- SQLite booleans are `0/1` integers; timestamps are UTC text `YYYY-MM-DD HH:MM:SS`. Session times are SGT.
- `absences.type = 'off'` means "rostered off" (part-timer non-working slot), not a disruption.
- A session with `therapist_id = NULL` and `status = 'scheduled'` means "needs cover" (parent declined the substitute).
- Known gaps / good next tasks: real WhatsApp sending, OL/observing availability, therapist phone numbers,
  auth/roles (anyone can call every endpoint), a shared secret on `/api/whatsapp/responses`.
