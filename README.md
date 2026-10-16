# Team-18: Therapist Reallocation (Autism Partnership, CFG 2026)

Local web app for rapidly reallocating therapist sessions when staff are absent: report absences, let the
engine propose replacements (with reasons), approve or reject them, and keep a full audit trail.

| Folder | Stack | Port |
| --- | --- | --- |
| [backend/](backend) | Next.js 16 API routes, SQLite (better-sqlite3), zod, vitest | 3001 |
| [frontend/](frontend) | React 19, Vite, TypeScript, Tailwind v4, React Query | 5173 |
| [docs/](docs) | Challenge brief, notes, sample data | |

## Quick start (Node 22+)

```bash
cd backend && npm install && npm run db:reset && npm run dev
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173 and click **Generate proposals** for 11 July 2031 (the case scenario).

**Before contributing, read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md)**, plus the ones in
the folder you're working in. Point your AI agent at them too.
