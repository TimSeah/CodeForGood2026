# AGENTS.md (repo root)

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, …) and humans working in this repo.
**Read this file, then the `AGENTS.md` in the folder you are changing, if present** (`backend/AGENTS.md` or `frontend/AGENTS.md`).

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
| Plan (tier) | **Core** → juniors only · **Advanced** → senior/junior mix · **Specialised** → seniors only |
| Blacklist | Therapists a child's parents aren't comfortable with: last resort only. |
| Home / School session | Case brief says designated therapist only; **unconfirmed** — behind a config flag (default: reassignable). |
| OL | "Observing / overlapping" in the therapist sheets — not truly free. Only "OL/Replacement" means free. |

Matching rules (full spec + flow: **[docs/plans/rescheduling.md](docs/plans/rescheduling.md)** — read it before
touching rescheduling, approval, intake or messaging):
1. **Hard:** the replacement must be working, not absent, not already booked in that slot, not declined by the parent.
2. Minimise cancellations ("any therapist is better than no therapist").
3. Then: same team → tier match → covered this child before → anyone → blacklisted. Ties broken by distance.
4. Chain swaps (A→B's child, B→C) only as a separate alternative plan, and only if they avoid a cancellation.
5. Admin approves every plan; parents must accept via WhatsApp (or admin records it) by start − 15 min.
6. **Admin-confirmed scheduling rules** ([docs/plans/scheduling-preferences.md](docs/plans/scheduling-preferences.md)):
   hard "never" rules exclude a therapist (validation error if forced); soft "avoid" rules rank after cancellations
   but before team/tier/history/distance. Suggestions learned from repeated admin changes **never** apply until an
   admin confirms them. Don't add any learning that skips that confirmation.

⚠️ The case study uses a **fictional calendar**: 3 July 2031 is a Monday and 11 July 2031 is a Tuesday in the
documents. Seed data follows the documents. Don't "fix" weekdays with `Date#getDay()`.

## Repo layout

```
.
├── AGENTS.md / CONTRIBUTING.md   ← you are here (repo-wide rules)
├── backend/                      Next.js 16 (App Router), API routes only, SQLite via better-sqlite3 → :3001
├── frontend/                     React 19 + Vite + TypeScript + Tailwind v4 + React Query → :5173
├── bot/                          WhatsApp absence intake, local OCR, separate SQLite database → :3000
├── docs/                         Challenge brief, notes, and source data (docs/data/*.xlsx, *.docx)
└── .claude/launch.json           Dev-server definitions (backend, frontend)
```

The frontend calls `/api/*`; Vite proxies that to `http://localhost:3001`. No CORS, no auth (local prototype).
The bot collects reports into its own SQLite file; the backend **reads** it (read-only, `BOT_DB_PATH`) via
`POST /api/intake/sync`. Outbound WhatsApp (asking parents to confirm, briefing substitutes) is a **placeholder**
(`backend/src/lib/services/whatsapp/gateway.ts`, marked `TODO(bot-integration)`) until the bot exposes a send API;
parent replies should go to `POST /api/whatsapp/responses`.
For bot changes, run `npm test` from `bot/` (Node 24+).

## Running everything

```bash
cd backend && npm install && npm run db:reset && npm run dev      # terminal 1 → http://localhost:3001
cd frontend && npm install && npm run dev                          # terminal 2 → http://localhost:5173
```

## Cross-cutting rules for agents

- **Stay in your lane.** A task touches `backend/`, `frontend/`, or `bot/` unless it is explicitly an API contract change.
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
