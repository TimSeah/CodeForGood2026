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

Run `npm run setup` only on a fresh clone: it runs `db:reset` and **deletes existing backend records**. After that, `npm run dev` starts the backend and frontend together; press
Ctrl+C to stop both. Open http://localhost:5173: the 11 July 2031 case scenario is pre-loaded as simulated WhatsApp reports.
Review the draft on **Approval**, approve it, and try parent replies. The full workflow is in
[docs/plans/rescheduling.md](docs/plans/rescheduling.md).
For an existing POC database, do not re-run setup; install missing dependencies separately and start the servers.

## Environment configuration

The backend loads `backend/.env.local`. Start by copying the complete template:

```powershell
Copy-Item backend/.env.example backend/.env.local
```

The template groups every backend setting by feature. For the standard local web app, the defaults for
`DATABASE_PATH` and `BOT_DB_PATH` are sufficient. Fill in `CENTRE_PHONE` if parent messages should display a real
contact number. `OPENAI_API_KEY` is shared by the AI scheduler and session video review; their models can be
configured independently with `OPENAI_MODEL` and `OPENAI_VIDEO_MODEL`.

The WhatsApp bot's separate checklist is `bot/.env.example`. Its four Meta credentials are required when running
the bot. The bot does not automatically load an env file, so set those values in the process environment as shown
in [bot/README.md](bot/README.md); the remaining bot settings have documented defaults.

## AI-assisted rescheduling

The Approval page supports deterministic rule-based drafting and an AI scheduling agent. To enable the agent,
set `OPENAI_API_KEY` for the backend process; optionally set `OPENAI_MODEL` (the default is `gpt-5-mini`). The API
key stays server-side and is never sent to the browser.

## Session video review

Open **Video review** in the app to upload a recording. Source videos and generated clips are stored under
`backend/data/video-reviews/` and are ignored by Git. The backend extracts a compressed transcript and sampled
frames for OpenAI analysis, then uses its bundled FFmpeg binary to create the local MP4 clips.

## WhatsApp absence intake bot

The [bot](bot/README.md) collects therapist and patient absences through WhatsApp. It uses a separate database;
the backend imports confirmed reports, creates draft plans, and queues notifications after approval. Its README
explains the local bot connection and the session-only POC mode, which requires recipients to message the bot
before standard text can be sent without approved Meta templates.

For a recording with the richer fictional July 2031 scenario, use a separate database instead of resetting
your live WhatsApp POC. From `backend/`, set `DATABASE_PATH=data/demo-video.db` before running
`npm.cmd run db:reset` **only when that file does not already exist**. Start the backend with the same
`DATABASE_PATH` and `BOT_DB_PATH=data/demo-video-bot.sqlite` to keep live bot reports out of this manual
case study. The frontend still runs on port 5173; open `/?date=2031-07-11` for the preloaded draft, or
`/?date=2031-07-12` to enter a new report by hand. Seeded phone numbers are fictional: choose
**No, I’ll contact them** if approving a case-study plan, not **Approve & send messages**.
For a quick walkthrough, match the preloaded report named **Jacq** to **Jacqueline** on 11 July,
review the updated draft, approve it manually, then record an **Accepted** reply. To create a
report yourself, switch to 12 July and add **Therapist → Amelia → Full day → Until 2031-07-12**
with MC unchecked; her two scheduled sessions should generate a new draft for that day.
To return to the live October 2026 WhatsApp POC, restore `DATABASE_PATH=data/app.db` and
`BOT_DB_PATH=../bot/absences.sqlite` in the ignored `backend/.env.local`, then restart the backend.

**Before contributing, read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md)**, plus any instructions
in the folder you're working in.
