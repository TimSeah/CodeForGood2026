# frontend/AGENTS.md

React 19 + Vite + TypeScript (strict) + Tailwind CSS v4 + TanStack React Query v5 + React Router.
Runs on port 5173 and talks to the backend via `/api/*` (proxied to :3001 in `vite.config.ts`).
Read the root `AGENTS.md` first.

## Folder structure (feature-based)

```
frontend/src/
├── main.tsx                  Providers (React Query, Router). Rarely touched.
├── App.tsx                   Route table. Add new pages here.
├── index.css                 Tailwind import + tiny global styles
├── api/
│   ├── client.ts             fetch wrapper: api.get/post/patch, unwraps { data } / throws ApiError
│   └── types.ts              MIRROR of backend/src/lib/types.ts (backend is the source of truth)
├── components/               Shared, presentational, feature-agnostic
│   ├── AppLayout.tsx         Header + nav + <Outlet/>. Add nav links here.
│   └── ui.tsx                Card, Badge, Button, DateInput, QueryState
├── hooks/                    Shared hooks (e.g. useSelectedDate: date lives in ?date= URL param)
├── lib/                      Pure helpers (formatting etc.). No React.
└── features/<feature>/       One folder per domain area
    ├── api.ts                React Query hooks for this feature (queries, mutations, query keys)
    └── <Thing>Page.tsx / <Thing>Panel.tsx   Components for this feature
```

Current features: `reallocation` (main Disruptions page), `absences`, `schedule`, `audit`, `reference`
(therapists/students lookups shared by other features).

## Rules

- **Data fetching only through React Query hooks in `features/*/api.ts`.** Components never call `fetch` or
  `api.*` directly. Each hook file exports its query-key helpers (`sessionsKey(date)`) so mutations elsewhere
  can invalidate them.
- **Mutations invalidate what they change** (e.g. approving a reallocation invalidates reallocations + sessions).
- **Types come from `@/api/types`.** Don't redeclare API shapes in components. If the backend shape changed,
  update `api/types.ts` to match `backend/src/lib/types.ts`.
- **Features may import from `components/`, `hooks/`, `lib/`, `api/`, and other features' `api.ts`** — but not
  from other features' components. If two features need the same component, move it to `components/`.
- **Styling: Tailwind utility classes only.** No CSS modules, no styled-components, no UI kit unless the team agrees.
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
