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
npm run setup
npm run dev
```

Run `npm run setup` once after cloning. After that, `npm run dev` starts the backend and frontend together; press
Ctrl+C to stop both. Open http://localhost:5173: the 11 July 2031 case scenario is pre-loaded as WhatsApp reports.
Review the draft on **Approval**, approve it, and try parent replies. The full workflow is in
[docs/plans/rescheduling.md](docs/plans/rescheduling.md).

## Environment configuration

The backend loads `backend/.env`. Start by copying the complete template:

```powershell
Copy-Item backend/.env.example backend/.env
```

The template groups every backend setting by feature. For the standard local web app, the defaults for
`DATABASE_PATH` and `BOT_DB_PATH` are sufficient. Fill in `CENTRE_PHONE` if parent messages should display a real
contact number. `OPENAI_API_KEY` is shared by the AI scheduler and session video summaries; their models can be
configured independently with `OPENAI_MODEL` and `OPENAI_VIDEO_MODEL`.

The WhatsApp bot's separate checklist is `bot/.env.example`. Its four Meta credentials are required when running
the bot. The bot does not automatically load an env file, so set those values in the process environment as shown
in [bot/README.md](bot/README.md); the remaining bot settings have documented defaults.

## AI-assisted rescheduling

The Approval page supports deterministic rule-based drafting and an AI scheduling agent. To enable the agent,
set `OPENAI_API_KEY` for the backend process; optionally set `OPENAI_MODEL` (the default is `gpt-5-mini`). The API
key stays server-side and is never sent to the browser.

## Session videos

Therapists can attach a recording to a **Session log**. The original video stays on the backend computer and is
not analyzed during upload. A therapist can request a gist and short, titled clips from the log, or an approved
cover assignment can trigger the same processing so the incoming therapist sees the handover. Source videos and
generated clips are stored under `backend/data/video-reviews/` and are ignored by Git; the backend uses its
bundled FFmpeg binary to create local MP4 clips.

## WhatsApp absence intake bot

The [bot](bot/README.md) collects therapist and patient absences through WhatsApp. It uses a separate database and
does not yet submit reports to the web app's absence API. See its README for the conversation flow, setup, and tests.

**Before contributing, read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md)**, plus any instructions
in the folder you're working in.
