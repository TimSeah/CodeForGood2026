# Cover Desk

**Rebuilds the day's therapy schedule in minutes when therapists call in sick, and explains every change it proposes.**

[See the walkthrough](#walkthrough) ·
[How the engine works](#how-it-works) ·
[Run it locally](#run-it-locally) ·
[Read the rescheduling spec](docs/plans/rescheduling.md) ·
[Read the challenge statement (PDF)](docs/AutismPartnership-Challenge-Statement-CFG2026.pdf)

![Next.js 16](https://img.shields.io/badge/Next.js-16-171918.svg)
![React 19](https://img.shields.io/badge/React-19-0F5F57.svg)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-0F5F57.svg)
![WhatsApp Cloud API](https://img.shields.io/badge/WhatsApp-Cloud_API-25D366.svg)
![Tests](https://img.shields.io/badge/tests-83_passing-2E7D4F.svg)

Cover Desk is a local web app and WhatsApp bot built for **Autism Partnership** at the **Code for Good 2026**
hackathon (Singapore). Autism Partnership runs one-to-one therapy for young children. When therapists report
an absence by 7 AM, an admin has about 30 minutes to rebuild the schedule using Excel, WhatsApp, and what
they remember about each family.

Cover Desk takes absence reports from WhatsApp and drafts a replacement plan with a **deterministic,
explainable matching engine**. A supervisor approves the plan, and parents confirm each change. Every step is
recorded in an audit trail.

> **The challenge:** *"How might you help Autism Partnership design a secure and auditable solution that
> supports rapid resource reallocation when operational disruptions occur, while maintaining service
> continuity, practical feasibility and timely notification of impacted individuals?"*

## Highlights

- **WhatsApp intake that therapists and parents already use.** A guided chat collects who is absent, which
  dates, and whether it is the morning, afternoon, or whole day. Medical certificates are read with
  **local OCR**, and the documents are never stored.
- **Optimal, explainable matching.** Each AM/PM slot is solved as a minimum-cost assignment using the
  **Hungarian algorithm**. A cancellation always costs more than any valid match, so the engine prefers any
  qualified therapist over cancelling a session. Every proposal shows a human-readable *"why this choice"*.
- **Chain-swap alternatives.** If moving one therapist frees another and avoids a cancellation
  (A covers B's child, so B can cover C), the engine offers that as a separate plan for the admin to choose.
- **People stay in control.** Nothing is sent or changed until an admin approves. Parents accept or decline
  on WhatsApp, or the admin records their reply. If a parent declines, the engine re-plans automatically.
- **Scheduling memory that never learns silently.** Admins can add "never" and "avoid" rules. Patterns in
  repeated admin edits only become **suggestions** until someone confirms them.
- **Optional AI scheduling agent.** An OpenAI function-calling agent can revise the safe rule-based draft from
  a plain-English instruction, using only the same validated tools as the engine.
- **Auditable by default.** Every intake, plan, edit, approval, parent reply, and rule change writes an audit
  entry.

## Walkthrough

All screenshots use the challenge's fictional **11 July 2031** scenario. Nine therapists and two children
were reported absent before 7 AM. They were captured from a fresh local database with Chrome DevTools.

### 1. The 7 AM briefing

The **Today** page combines WhatsApp reports into a three-step flow: *Reports in → Review plan → Parents
confirm*. If a name doesn't match the roster, such as "Jacq", the admin must match it before it counts. After
the admin matches it to Jacqueline, the draft re-plans immediately.

![Today's disruptions dashboard showing 9 therapist reports, 2 child absences, 12 sessions covered, 5 proposed cancellations, and an unmatched WhatsApp report](docs/assets/01-today-briefing.png)

### 2. Review an explainable draft

Each row shows the absent therapist, the proposed replacement, the matching rule it satisfied, the distance
from the child's home, and warnings such as *"not on the child's team"*. If no qualified therapist is free,
the row is shown as a cancellation for the admin to review.

| Draft plan with rationale | Override with ranked, validated candidates |
| :---: | :---: |
| ![Review and approve page listing each reassignment with the reason it was chosen](docs/assets/02-review-approve.png) | ![Change panel listing the best available therapist first, then unavailable therapists with reasons such as Away (medical) or Booked with another child](docs/assets/03-override-candidates.png) |

### 3. Approve without surprises

Approval asks whether to send WhatsApp messages or have the admin contact families directly. Parents must
reply by **15 minutes before the session**. Substitute therapists receive a handover.

| Approve dialog | Optional AI scheduling agent |
| :---: | :---: |
| ![Approve dialog explaining what parents and therapists will receive, with options to send messages or contact them manually](docs/assets/05-approve-dialog.png) | ![AI scheduling agent tab with a plain-English instruction to find a closer therapist for Brock](docs/assets/04-ai-agent.png) |

### 4. Parents confirm, and declines re-plan automatically

The **Parent replies** page tracks each approved change against its deadline. When Brock's parents declined
Alexa, the engine excluded her and re-planned. It also found a **chain swap**: Eileen moves from Hughie to
Brock, and Alexa covers Hughie. This keeps both sessions running with no cancellation.

| Track replies against deadlines | Chain-swap alternative after a decline |
| :---: | :---: |
| ![Parent replies page showing 8 of 12 replied with accepted, declined, and waiting counts](docs/assets/06-parent-replies.png) | ![Re-plan with a swap alternative selected: Eileen covers Brock and Alexa covers Hughie, with 0 cancellations](docs/assets/07-swap-alternative.png) |

### 5. Rules the engine remembers

Admins can add hard **"never"** rules, which validation enforces, and soft **"avoid"** rules, which affect
ranking after cancellations but before team, tier, history, and distance. Patterns in admin edits only
become suggestions until someone confirms them.

![Scheduling rules page showing an active avoid rule for Jade after 5 PM on Tue/Thu and a never rule for Alexa with Brock](docs/assets/08-scheduling-rules.png)

### 6. The schedule, before and after

| Recurring MWF / TT allocation | The day as it stands |
| :---: | :---: |
| ![Monthly schedule table showing each therapist's Mon-Wed-Fri and Tue-Thu sessions with seniority and location](docs/assets/09-schedule-monthly.png) | ![Daily schedule with morning and afternoon sessions tagged reassigned, cancelled, parent accepted, or awaiting parent](docs/assets/10-schedule-daily.png) |

The **Confirmed calendar** shows only appointments that are confirmed, including accepted cover changes, so
each therapist can see where they need to be.

![Confirmed calendar for Jade showing her accepted cover session with Anthony on 11 July](docs/assets/11-confirmed-calendar.png)

### 7. Therapist portal and session handover

Therapists log attendance, goals, and notes for each session, and can download a shareable PDF. If a child's
next session is covered, the substitute receives the previous summary. A session video can also be attached
and summarised into titled clips with OpenAI for the handover (see [limitations](#limitations)).

| Session history per child | Log a covered session (with optional video) |
| :---: | :---: |
| ![Session logs table for Anthony showing dates, therapists, attendance, and summaries](docs/assets/12-session-logs.png) | ![Session log form for Jade covering Anthony with attendance, summary, goals, notes, and video upload](docs/assets/13-log-form.png) |

### 8. Every change, recorded

![Audit trail listing session logs, rule creation, parent accept and decline events, plan approvals, and engine and AI-agent drafts](docs/assets/14-audit-trail.png)

### Responsive view

| Today | Parent replies | Therapist portal |
| :---: | :---: | :---: |
| ![Mobile Today page with the three-step progress](docs/assets/mobile-today.png) | ![Mobile parent replies with Accepted and Declined buttons](docs/assets/mobile-replies.png) | ![Mobile session logs for a covering therapist](docs/assets/mobile-session-logs.png) |

## How it works

```mermaid
flowchart LR
  subgraph People
    T[Therapists]
    P[Parents]
    A[Admin / supervisor]
  end
  T & P -- WhatsApp --> META[Meta WhatsApp<br/>Cloud API]
  META -- webhook --> BOT["bot/ (Node 24)<br/>guided chat · local MC OCR<br/>own SQLite"]
  BOT -- "sync every 30 s<br/>(read-only DB)" --> API["backend/ (Next.js 16 API)<br/>SQLite · zod · audit log"]
  API --> ENG["Rule engine<br/>rank → Hungarian → swaps → validate"]
  API -. optional .-> AGENT["OpenAI agent<br/>function tools"]
  AGENT -. same tools .-> ENG
  A -- browser --> UI["frontend/ (React 19 + Vite)<br/>Tailwind · React Query"]
  UI -- "/api proxy" --> API
  API -- "outbox (after approval)" --> BOT
  BOT -- "templates / session text" --> META
```

### The matching engine

The engine is **pure TypeScript with no I/O** ([`engine.ts`](backend/src/lib/services/reallocation/engine.ts)),
so it can be unit tested with fixtures.

1. **Hard filters:** A replacement must be working that day, not absent, not already booked in that slot, not
   declined by the parent for this session, and not excluded by a confirmed "never" rule.
2. **Rank each candidate** with the agreed hierarchy
   ([`ranking.ts`](backend/src/lib/services/reallocation/ranking.ts)):

   | Step | Rule |
   | --- | --- |
   | 1. Team | On the child's regular team (1–4 therapists) |
   | 2. Tier | Seniority fits the child's plan: **Core** → junior, **Specialised** → senior, **Advanced** → either |
   | 3. History | Has covered this child before |
   | 4. Any | Anyone else who is free |
   | 5. Blacklisted | A therapist the parents are uncomfortable with, used only as a last resort |

3. **Solve each slot optimally.** AM and PM are solved independently as a minimum-cost assignment
   ([`hungarian.ts`](backend/src/lib/services/reallocation/hungarian.ts)). The cost is
   `cancellation ≫ soft-rule penalty ≫ rank step ≫ distance (km)`, so the engine first minimises
   cancellations, then follows the ranking hierarchy, and uses distance to break ties.
4. **Offer chain swaps separately** ([`swaps.ts`](backend/src/lib/services/reallocation/swaps.ts)). Swaps appear
   only as an alternative plan, and only when they avoid a cancellation.
5. **Validate before approval.** Every admin edit and every AI-agent change goes through the same validator.
   Hard conflicts block approval, while soft warnings are shown in the row.

### The AI scheduling agent

[`rescheduling-agent.ts`](backend/src/lib/services/rescheduling-agent.ts) starts from the rule-based draft and
runs an OpenAI function-calling loop with four tools: `read_draft`, `list_candidates`, `set_assignment`, and
`finish_plan`. The agent edits an in-memory copy. Nothing is saved until `finish_plan` passes validation, and
the result is still a **draft** for an admin to approve. If an instruction sounds like a lasting rule, the app
asks the admin to confirm it separately instead of learning it automatically.

### WhatsApp intake bot

The [bot](bot/README.md) guides each reporter through role → name → *Today / Tomorrow / Other dates* →
whole day, morning, or afternoon. It also accepts typed date ranges such as `DD/MM/YYYY to DD/MM/YYYY`.
Reporters can attach an MC as an image or PDF. The bot extracts a **tentative** name and absence dates
locally, using embedded PDF text or Tesseract OCR, then asks the reporter to confirm them. It keeps only a
media ID and SHA-256 digest, never the document. It checks webhook signatures, removes duplicate messages,
and retries failed sends up to five times.

## Verification

| Check | Result |
| --- | --- |
| Backend unit tests (`vitest`): engine, swaps, preferences, pattern detection, AI-agent draft, WhatsApp bridge | **59 / 59 pass** |
| Bot tests (`node --test`): webhook signatures, duplicate handling, Singapore-time dates, persistence, image and scanned-PDF OCR | **24 / 24 pass** |
| Frontend production build (`tsc --noEmit && vite build`) | Pass |
| End-to-end browser pass via Chrome DevTools: intake → name match → draft → override → approve → parent replies → re-plan → swap → rules → logs → audit | Pass, captured above |

## Run it locally

Requires **Node.js 22+**, and **Node.js 24+** for the bot.

```bash
npm run setup    # installs backend + frontend and seeds the 11 July 2031 case study
npm run dev      # backend → http://localhost:3001, frontend → http://localhost:5173
```

Open <http://localhost:5173/?date=2031-07-11>. The case scenario is preloaded as simulated WhatsApp reports.

> `npm run setup` runs `db:reset` and **deletes existing backend records**. Run it only on a fresh clone.
> On Windows, stop the backend before resetting because SQLite locks the database file.

### Try the demo flow

1. On **Today**, match the report from **"Jacq"** to **Jacqueline**. The draft re-plans.
2. Open **Review & approve**, click **Change** on any row, then **Approve plan… → "No, I'll contact them"**.
   Seeded phone numbers are fictional, so don't choose *Approve & send messages*.
3. On **Parent replies**, mark **Brock** as **Declined**. Then return to *Review & approve* to see the re-plan
   and its **Swap alternative**.
4. To enter a report yourself, switch to **12 July** and add **Therapist → Amelia → Full day**.

To keep a separate demo database alongside a live WhatsApp setup, set `DATABASE_PATH=data/demo-video.db` and
`BOT_DB_PATH=data/demo-video-bot.sqlite` before running `npm run db:reset` and `npm run dev` in `backend/`. To
run a second copy, start the backend on another port and set `API_PROXY_TARGET` for the frontend.

### Environment configuration

The core app works without secrets. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` to
enable optional features:

| Variable | Needed for |
| --- | --- |
| `DATABASE_PATH`, `BOT_DB_PATH` | Database locations; the defaults work locally |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VIDEO_MODEL` | AI scheduling agent and session-video summaries |
| `BOT_SHARED_SECRET`, `CENTRE_PHONE` | Live bot ↔ backend bridge and the contact number shown in parent messages |

The bot reads [`bot/.env.example`](bot/.env.example), which requires Meta WhatsApp Cloud API credentials and a
public HTTPS webhook. [bot/README.md](bot/README.md) covers the Cloudflare Tunnel launcher, session-only POC
mode, and the seven Utility message templates in
[docs/plans/whatsapp-templates.md](docs/plans/whatsapp-templates.md).

## Limitations

- **Not shown live:** The **AI scheduling agent** and **session-video summaries** require a valid
  `OPENAI_API_KEY`. The key in the capture environment had been revoked, so the screenshots show the agent UI
  and the drafting flow but not an agent-generated plan. Both features have unit-tested logic, but the OpenAI
  calls were not run during this capture.
- **WhatsApp conversations are not screenshotted.** A live demo requires a Meta business number, access
  tokens, a public webhook, and recipients who message the bot first, or approved message templates. I
  verified the bot with its automated tests, and the admin portal shows the imported reports.
- **Local prototype:** It has no authentication or role-based access, so it should run only on a trusted
  machine. Production use would need SSO, encrypted storage, and retention policies for medical-certificate
  metadata.
- **Assumptions that need confirmation:** Whether home or school sessions must stay with their designated
  therapist is behind a config flag, and reassignment is allowed by default. Distance uses straight-line
  kilometres between home areas, not travel time.
- **Fictional calendar:** The case study treats 3 July 2031 as a Monday. The seed data follows the case
  documents, not the real calendar.
- On narrow phones, some status chips on the daily schedule can overlap.

## Team

Built by Team 18 over the two-day Code for Good 2026 hackathon in Singapore.

**My role (Timothy Seah, [@TimSeah](https://github.com/TimSeah))**: I built the **WhatsApp absence-intake bot**.
That work includes the guided conversation, Singapore-time date parsing, local MC OCR for images and scanned
PDFs, webhook signature checks, and retrying outbound delivery. I also connected the bot to the backend for
report sync, parent replies, and the approved-plan outbox. My other work includes the Cloudflare Tunnel demo
launcher with Windows autostart, the live session-only POC mode, and the challenge notes and documentation.

Teammates built the rescheduling engine and approval flow, the scheduling-preference memory, the AI agent and
video handover, and the confirmed calendar and UI.

## Repository layout

```text
backend/                 Next.js 16 API routes (port 3001), SQLite via better-sqlite3
  src/lib/services/
    reallocation/        pure engine: ranking, Hungarian assignment, swaps, validation
    preferences/         admin-confirmed rules + suggestion detection
    whatsapp/            outbox, delivery receipts, bot bridge auth
    rescheduling-agent.ts  OpenAI function-calling agent
  src/lib/db/            migrations + seed data from the case-study spreadsheets
frontend/                React 19 + Vite + Tailwind v4 + React Query (port 5173)
  src/features/          one folder per page: disruptions, approval, preferences, schedule, calendar, logs, audit
bot/                     WhatsApp Cloud API intake bot (port 3000), local OCR, separate SQLite
docs/
  plans/                 rescheduling spec, scheduling-preference design, WhatsApp templates
  data/                  sample schedules, case allocation and the 11 July 2031 scenario
  assets/                Chrome DevTools captures used in this README
scripts/dev.mjs          one-command launcher for backend + frontend
```

## Documentation

- [docs/plans/rescheduling.md](docs/plans/rescheduling.md): end-to-end flow, matching rules, approval and
  parent-confirmation rules.
- [docs/plans/scheduling-preferences.md](docs/plans/scheduling-preferences.md): hard and soft rules, and
  suggestion detection with admin confirmation.
- [docs/plans/whatsapp-templates.md](docs/plans/whatsapp-templates.md): the seven Utility templates to
  submit to Meta.
- [bot/README.md](bot/README.md): reporter journey, local run, tunnel launcher, data handling.
- [docs/challenge_notes.md](docs/challenge_notes.md): notes from the briefing with Autism Partnership.
- [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md): conventions for contributors and AI coding
  agents. Read these before changing code.

All names and phone numbers in the seed data are fictional case-study data.
