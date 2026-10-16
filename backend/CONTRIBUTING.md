# Contributing to the backend

Repo-wide workflow (branches, commits, PRs) is in [../CONTRIBUTING.md](../CONTRIBUTING.md). Architecture and
layering rules are in [AGENTS.md](AGENTS.md) — read that before writing code.

## Setup

```bash
cd backend
npm install
cp .env.example .env.local     # optional; defaults work
npm run db:reset               # creates data/app.db with the July 2031 case data + 11 July scenario
npm run dev                    # http://localhost:3001/api/health
```

## Conventions

- TypeScript strict. Import from `@/…` (maps to `src/`), not long relative paths.
- File names: `kebab-case.ts` or a single lowercase word; route folders follow URL paths (`api/plans/[id]/approve`).
- DB columns `snake_case`; TypeScript/JSON fields `camelCase`. Repositories do the mapping.
- Every route: `export const GET = handle(...)`, validate with zod, return `ok(data)` (or `ok(data, 201)` on create).
- Every write: inside a service, inside a transaction, with `logAudit({ actor, action: "<entity>.<verb>", ... })`.
- Prefer small, pure functions for logic you want to test; put tests next to the file as `*.test.ts`.

## Database changes

1. Create `src/lib/db/migrations/00N_short_description.sql` (next number). **Never edit a merged migration.**
2. Update repositories and `src/lib/types.ts` (+ the frontend mirror if the API shape changed).
3. Stop the dev server, run `npm run db:reset`, start it again.
4. Tell the team in chat — everyone needs to `db:reset` after pulling.

## Definition of done

- [ ] `npm run typecheck`, `npm test`, `npm run build` all pass
- [ ] New logic in the engine has a test in `engine.test.ts`
- [ ] New write endpoints log to the audit table
- [ ] API table in `AGENTS.md` updated if you added/changed an endpoint
- [ ] Manually hit the endpoint (browser, curl, or via the frontend)

```bash
curl -X POST localhost:3001/api/plans/generate -H "content-type: application/json" -d '{"date":"2031-07-11"}'
```
