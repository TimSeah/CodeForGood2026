# AGENTS.md (repo root)

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, …) and humans working in this repo.
**Read this file, then the `AGENTS.md` in the folder you are changing** (`backend/AGENTS.md` or `frontend/AGENTS.md`).

## What we're building

A local web app for **Autism Partnership** (Code for Good 2026 hackathon) that handles **rapid reallocation of
therapist sessions** when therapists are absent. Absences are reported by 7 AM; today an admin spends ~30 minutes
rebuilding the schedule from Excel + WhatsApp. We want: report absences → engine proposes replacements with
reasons → supervisor approves/rejects → everything is audited → affected people are notified.

Background: `docs/challenge_notes.md`, `docs/AutismPartnership-Challenge-Statement-CFG2026.pdf`,
and the sample data in `docs/data/` (schedules, case allocation, and the 11 July 2031 case scenario).

### Domain cheat-sheet

| Term | Meaning |
| --- | --- |
| SBT / LBT | Senior / Lead Behavior Therapist — **senior** |
| BT / PT | Behavior / Program Therapist — **junior** |
| Slot | `AM` (≈8:30–12:00) or `PM` (≈2:00–5:30). Exact times vary per session. |
| MWF / TT | Weekly patterns: Mon-Wed-Fri vs Tue-Thu. A child has a fixed therapist per pattern + slot. |
| Team | The 1–4 therapists who regularly work with a child. Best replacements come from the team. |
| Home / School session | Only the child's designated therapist may run it → if they're away, the session is cancelled. |
| OL | "Observing / overlapping" in the therapist sheets — not truly free. Only "OL/Replacement" means free. |

Matching rules, in priority order:
1. **Hard:** the replacement must be working, not absent, and not already booked in that slot.
2. **Hard:** home/school sessions can't be reassigned.
3. **Soft:** prefer someone on the child's team (familiarity).
4. **Soft:** senior → senior; junior covering a senior's case is allowed but worse.
5. If nobody fits → propose cancellation (worst case). Minimise cancellations overall.

⚠️ The case study uses a **fictional calendar**: 3 July 2031 is a Monday and 11 July 2031 is a Tuesday in the
documents. Seed data follows the documents. Don't "fix" weekdays with `Date#getDay()`.

## Repo layout

```
.
├── AGENTS.md / CONTRIBUTING.md   ← you are here (repo-wide rules)
├── backend/                      Next.js 16 (App Router), API routes only, SQLite via better-sqlite3 → :3001
├── frontend/                     React 19 + Vite + TypeScript + Tailwind v4 + React Query → :5173
├── docs/                         Challenge brief, notes, and source data (docs/data/*.xlsx, *.docx)
└── .claude/launch.json           Dev-server definitions (backend, frontend)
```

The frontend calls `/api/*`; Vite proxies that to `http://localhost:3001`. No CORS, no auth (local prototype).

## Running everything

```bash
cd backend && npm install && npm run db:reset && npm run dev      # terminal 1 → http://localhost:3001
cd frontend && npm install && npm run dev                          # terminal 2 → http://localhost:5173
```

## Cross-cutting rules for agents

- **Stay in your lane.** A task touches `backend/` or `frontend/` unless it is explicitly an API contract change.
  Never edit both sides of an API change without updating the types on both sides (see below).
- **API contract = `backend/src/lib/types.ts`.** `frontend/src/api/types.ts` is a hand-kept mirror. Change the
  backend file first, then copy the change to the frontend file in the same commit.
- **Response envelope is fixed:** success `{ "data": ... }`, error `{ "error": { "message", "details?" } }`.
- **Every state change is audited** (`logAudit` in the backend). If you add a write endpoint, add an audit entry.
- **Explainability matters for the pitch:** anything that proposes a change must carry a human-readable `rationale`.
- **No real personal data.** Use the fictional case-study names only. Never commit `.env*` files or `*.db` files.
- **Don't add heavy dependencies** (ORMs, UI kits, state libraries) without agreeing with the team first.
- **Keep it runnable.** Before you finish, run the checks listed in the folder's AGENTS.md and make sure they pass.
- Windows note: stop the backend dev server before `npm run db:reset`, or SQLite's file lock will make it fail.

See `CONTRIBUTING.md` for the git workflow.
