# frontend/AGENTS.md

React 19 + Vite + TypeScript (strict) + Tailwind CSS v4 + TanStack React Query v5 + React Router.
Runs on port 5173 and talks to the backend via `/api/*` (proxied to :3001 in `vite.config.ts`).
Read the root `AGENTS.md` first.

## Folder structure (feature-based)

```
frontend/src/
├── main.tsx                  Providers (React Query, Router). Rarely touched.
├── App.tsx                   Route table. Add new pages here.
├── index.css                 Tailwind import + theme tokens (bg-brand, text-muted, border-line, …)
├── api/
│   ├── client.ts             fetch wrapper: api.get/post/patch/delete, unwraps { data } / throws ApiError
│   ├── invalidate.ts         invalidateDayData(): refetch everything day-scoped after a write
│   └── types.ts              MIRROR of backend/src/lib/types.ts (backend is the source of truth)
├── components/               Shared, presentational, feature-agnostic
│   ├── AppLayout.tsx         Sidebar nav + <Outlet/>. Add nav links here.
│   ├── icons.tsx             Inline stroke icons (<Icon name=…/>)
│   ├── MonthCalendar.tsx     Sun–Sat month grid (like the per-person Excel sheets)
│   └── ui.tsx                PageHeader, Card, Badge, Button, LinkButton, DateInput, Field, Tabs, Callout, Avatar, Modal, QueryState, inputClass
├── hooks/                    Shared hooks (e.g. useSelectedDate: date lives in ?date= URL param)
├── lib/                      Pure helpers (formatting, case-calendar weekdays, labels). No React.
└── features/<feature>/       One folder per domain area
    ├── api.ts                React Query hooks for this feature (queries, mutations)
    └── <Thing>Page.tsx / <Thing>Panel.tsx   Components for this feature
```

Current features (see `docs/plans/rescheduling.md` for the workflow behind them):

| Feature | Route | What |
| --- | --- | --- |
| `disruptions` | `/` | 7 AM view: WhatsApp reports (therapist / parent), who's away, link to the draft plan |
| `intake` | — | WhatsApp report panels, unmatched-name resolution, manual report form, 30 s bot sync |
| `absences` | — | Who's away + planned-leave form |
| `approval` | `/approval`, `/replies` | Draft plan (+ swap alternative), editing with validation + change reasons, approve dialog, calendars · parent replies + outbox |
| `preferences` | `/preferences` | Scheduling rules: suggestions to confirm/reject (also on the Approval page via `SuggestionsPanel`), active/paused rules, edit/pause/remove, add rule |
| `schedule` | `/schedule` | Monthly MWF/TT allocation table + daily view |
| `logs` | `/logs` | Therapist portal: today's sessions, attendance + session log CRUD, PDF |
| `audit` | `/audit` | Audit trail |
| `reference` | — | Therapist / student lookups used everywhere |

## Rules

- **Data fetching only through React Query hooks in `features/*/api.ts`.** Components never call `fetch` or
  `api.*` directly.
- **Mutations invalidate what they change.** Anything that can change the day's plan (absences, reports,
  approvals, parent replies) calls `invalidateDayData(qc)` — the backend re-plans on most writes.
- **Types come from `@/api/types`.** Don't redeclare API shapes in components. If the backend shape changed,
  update `api/types.ts` to match `backend/src/lib/types.ts`.
- **Features may import from `components/`, `hooks/`, `lib/`, `api/`, and other features' `api.ts`.** A *page*
  may also compose another feature's exported `…Panel` / `…Form` (e.g. `DisruptionsPage` uses `BotReportsPanel`),
  but panels must not reach into other features' internals. If two features need the same small component,
  move it to `components/`.
- **Dates:** July 2031 uses the case study's fictional calendar — use `weekdayIndex` / `formatCaseDate` from
  `lib/format.ts`, never `new Date(date).getDay()`.
- **Styling: Tailwind utility classes only, using the theme tokens in `index.css`** (not raw slate/rose/… palettes). No CSS modules, no styled-components, no UI kit unless the team agrees.
  Reuse `components/ui.tsx` before inventing new buttons/cards.
- **Every query result handles loading, error and empty states** (use `<QueryState/>`).
- **Shared page state goes in the URL** (like `?date=`), not in global stores. No Redux/Zustand.
- Imports use the `@/` alias (→ `src/`). Components are named exports in `PascalCase.tsx`; one main component per file.
- Accessibility basics: real `<button>`s, labelled inputs, sensible contrast. Admins use this at 7 AM, fast.

## Recipes

**New page:** create `features/<name>/<Name>Page.tsx` (+ `api.ts`), add a `<Route>` in `App.tsx`, add a link in
`components/AppLayout.tsx`.

**New API call:** add the endpoint's types to `api/types.ts`, then a hook in the feature's `api.ts`:
```ts
export const useThings = (date: string) =>
  useQuery({ queryKey: ["things", date], queryFn: () => api.get<Thing[]>(`/things?date=${date}`) });
```

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 (start the backend too) |
| `npm run build` | Typecheck + production build. **Must pass before finishing a task.** |
| `npm run typecheck` | Types only |
