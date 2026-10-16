# Contributing to the frontend

Repo-wide workflow (branches, commits, PRs) is in [../CONTRIBUTING.md](../CONTRIBUTING.md). Structure and
rules are in [AGENTS.md](AGENTS.md) — read that before writing code.

## Setup

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 — the backend must be running on :3001
```

If every request fails with a 500/proxy error, the backend isn't running (`cd ../backend && npm run dev`).

## Conventions

- Components: `PascalCase.tsx`, named exports, one main component per file. Hooks: `useThing.ts`.
- Put code in the feature folder it belongs to; promote to `components/` / `hooks/` / `lib/` only when a second
  feature needs it.
- Server data → React Query hook in `features/<feature>/api.ts`. Local UI state → `useState`. Shared page state → URL.
- Tailwind for all styling. Keep the palette calm (slate + one accent); status colours via `<Badge tone=…>`.
- No `any`. If the API returns something new, add it to `api/types.ts`.

## Definition of done

- [ ] `npm run build` passes (no type errors, no unused variables)
- [ ] Loading, error, and empty states handled
- [ ] Clicked through the flow in the browser with the backend running; no console errors
- [ ] New page is reachable from the nav
- [ ] Works at laptop width (the admin's screen) and doesn't break on a narrow window
