# backend/AGENTS.md

Next.js 16 (App Router) used **only as an API server** on port 3001. SQLite via `better-sqlite3`
(synchronous, no ORM). Validation with `zod` v4. Tests with `vitest`. Read the root `AGENTS.md` first.

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
│       ├── validation/schemas.ts       zod schemas for every request body / query
│       ├── db/
│       │   ├── client.ts               getDb(): the single connection (auto-runs migrations)
│       │   ├── migrate.ts              Migration runner
│       │   ├── migrations/NNN_*.sql    Schema, one file per change, applied in order
│       │   ├── seed.ts                 Seed + case-scenario loader
│       │   └── seed-data.ts            AUTO-GENERATED from docs/data/Case-Allocation.xlsx
│       ├── repositories/<entity>.ts    ALL SQL lives here. Row → domain mapping (snake_case → camelCase)
│       └── services/                   Business logic + transactions + audit logging
│           ├── absences.ts
│           └── reallocation/
│               ├── engine.ts           PURE matching algorithm (no DB access). Unit tested.
│               ├── scoring.ts          Soft-preference weights. Tune here.
│               ├── engine.test.ts
│               └── index.ts            Loads data → runs engine → persists proposals; approve/reject
├── scripts/                            CLI scripts run with tsx (db:migrate, db:seed, db:reset, propose)
└── data/app.db                         SQLite file (git-ignored)
```

## Layering rules (important)

```
route.ts  →  services/*  →  repositories/*  →  getDb()
                ↓
         services/reallocation/engine.ts (pure)
```

- **Routes** never contain SQL or business logic. Always wrap handlers in `handle(...)` and return `ok(...)`.
  Validate every input with a schema from `validation/schemas.ts`.
- **Repositories** are the only place that call `getDb()` or write SQL. Use `?` placeholders — never string-concat
  user input into SQL. Return domain types from `types.ts`, not raw rows.
- **Services** coordinate multiple repositories, wrap multi-step writes in `getDb().transaction(...)`, and call
  `logAudit(...)` for every state change. Throw `HttpError(status, message)` for expected failures (404, 409…).
- **The engine is pure.** It receives sessions/absences/therapists/teams and returns proposals. No imports from
  `db/` or `repositories/`. This keeps it testable and swappable (e.g. an optimiser or LLM-assisted ranking).
- Simple read-only routes may call a repository directly (see `api/therapists/route.ts`).

## Recipes

**Add an endpoint** (e.g. `GET /api/notifications`):
1. Types in `lib/types.ts` (and mirror into `frontend/src/api/types.ts`).
2. Queries in `lib/repositories/notifications.ts`.
3. Logic/audit in `lib/services/notifications.ts` if it writes or combines data.
4. Schema in `lib/validation/schemas.ts`.
5. `src/app/api/notifications/route.ts` exporting `GET`/`POST` = `handle(...)`.
   Dynamic segments: `ctx: { params: Promise<{ id: string }> }` — params are a Promise in Next 16; `await` them.

**Change the schema:** add `src/lib/db/migrations/00N_description.sql`. Never edit an existing migration.
Update the affected repository + types, then `npm run db:reset`.

**Change matching behaviour:** weights → `scoring.ts`; hard constraints / ordering → `engine.ts`. Add a test case
in `engine.test.ts` for any rule you add. Run `npm run propose` to see the effect on the 11 July 2031 scenario.

**Regenerate seed data** after the Excel changes:
`python scripts/generate_seed_data.py ../docs/data/Case-Allocation.xlsx > src/lib/db/seed-data.ts`

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Dev server on :3001 |
| `npm run typecheck` / `npm test` / `npm run build` | **Run all three before finishing a task** |
| `npm run db:reset` | Delete DB, migrate, seed base data + case scenario (stop the dev server first on Windows) |
| `npm run db:seed [-- --scenario]` | Re-seed without deleting the file |
| `npm run propose [-- 2031-07-11]` | Run the engine for a date and print a table |

## API (current)

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/health` | |
| GET | `/api/therapists` | |
| GET | `/api/students` | |
| GET | `/api/sessions` | `?date=YYYY-MM-DD` |
| GET/POST | `/api/absences` | `?date=` / `{ therapistId, date, slot?, type, note?, actor? }` |
| GET | `/api/reallocations` | `?date=` |
| POST | `/api/reallocations/propose` | `{ date, actor? }` — replaces pending proposals for that date |
| PATCH | `/api/reallocations/:id` | `{ status: "approved" \| "rejected", actor? }` — approve applies it to the session |
| GET | `/api/audit` | `?limit=100` |

## Gotchas

- `better-sqlite3` is a native module; it's listed in `serverExternalPackages` in `next.config.ts`. Keep it there.
- SQLite booleans are `0/1` integers; timestamps are UTC text `YYYY-MM-DD HH:MM:SS`.
- `absences.type = 'off'` means "rostered off" (part-timer non-working slot), not a disruption.
- Known gaps / good next tasks: notifications (table exists, nothing writes it), OL/observing availability,
  travel distance in scoring, chained swaps to avoid cancellations, auth/roles.
