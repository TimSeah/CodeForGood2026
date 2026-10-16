# Contributing (repo-wide)

We're a hackathon team, mostly coding with AI agents. These rules exist so that five people and their agents can
work in parallel without stepping on each other. Folder-specific guides:
[backend/CONTRIBUTING.md](backend/CONTRIBUTING.md) · [frontend/CONTRIBUTING.md](frontend/CONTRIBUTING.md).

## Setup

Requirements: **Node 22+** and npm. Python 3 is only needed to regenerate seed data from Excel.

```bash
cd backend && npm install && npm run db:reset && npm run dev
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. Pick 11 July 2031 (the default) → **Generate proposals** → approve/reject.

## Git workflow

- `main` is the demo branch. Keep it runnable at all times.
- Branch per task: `feat/<area>-<short-name>`, `fix/<area>-<short-name>`, `docs/...`
  e.g. `feat/backend-notifications`, `feat/frontend-schedule-grid`.
- Small PRs, merged often. Rebase/merge `main` into your branch before opening a PR.
- Commit messages: `type(scope): summary` — e.g. `feat(backend): add notifications endpoint`,
  `fix(frontend): keep date when switching pages`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- One person owns a feature folder at a time. Say in the team chat which folder you (or your agent) are working in.

## Before you open a PR

| Folder | Run |
| --- | --- |
| backend | `npm run typecheck && npm test && npm run build` |
| frontend | `npm run build` (includes typecheck) |

- If you changed the DB schema: you added a **new** migration file (never edited an old one) and `npm run db:reset` works.
- If you changed an API shape: `backend/src/lib/types.ts` and `frontend/src/api/types.ts` both updated.
- Describe what you changed and how you tested it in the PR. If an AI agent wrote most of it, that's fine — but
  you are responsible for having read and run it.

## Working with AI agents

- Point your agent at `AGENTS.md` (root) + the folder's `AGENTS.md` at the start of a session. Claude Code reads
  `CLAUDE.md`, which simply imports `AGENTS.md`, so it picks these up automatically.
- Give the agent a narrow task and the folder it may touch. Ask it to follow the existing patterns in that folder.
- Keep a short log of useful prompts in the PR description — the judges ask about prompting/LLM usage.
- Don't let an agent "clean up" files outside your task, reformat whole folders, or upgrade dependencies.
