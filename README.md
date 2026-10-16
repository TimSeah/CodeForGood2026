# Team-18: Therapist Reallocation (Autism Partnership, CFG 2026)

Local web app for rapidly reallocating therapist sessions when staff are absent: report absences, let the
engine propose replacements (with reasons), approve or reject them, and keep a full audit trail.

| Folder | Stack | Port |
| --- | --- | --- |
| [backend/](backend) | Next.js 16 API routes, SQLite (better-sqlite3), zod, vitest | 3001 |
| [frontend/](frontend) | React 19, Vite, TypeScript, Tailwind v4, React Query | 5173 |
| [bot/](bot) | WhatsApp Cloud API absence intake, local OCR, SQLite | 3000 |
| [docs/](docs) | Challenge brief, notes, sample data | |

## Web app quick start (Node 22+)

```bash
cd backend && npm install && npm run db:reset && npm run dev
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173 and click **Generate proposals** for 11 July 2031 (the case scenario).

## WhatsApp absence intake bot

The [bot](bot/README.md) collects therapist and patient absences through WhatsApp. It uses a separate database and
does not yet submit reports to the web app's absence API. See its README for the conversation flow, setup, and tests.

**Before contributing, read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md)**, plus any instructions
in the folder you're working in.
