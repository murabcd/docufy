# Repository Guidelines

## Project Structure & Module Organization

- `src/`: TanStack Start (React + TypeScript) app code.
  - `src/routes/`: file-based routes (UI + loaders/actions).
  - `src/components/`, `src/hooks/`, `src/lib/`: shared UI, hooks, utilities.
  - `src/tiptap/`: editor extensions and collaboration helpers.
  - `src/routeTree.gen.ts`: generated route tree (do not edit by hand).
- `convex/`: Convex backend (queries/mutations, auth, schema).
  - `convex/_generated/`: generated Convex types/clients (do not edit).
- `public/`: static assets (e.g. `public/preview/`).
- Tooling/config: `vite.config.ts`, `tsconfig.json`, `biome.json`.

## Build, Test, and Development Commands

Use Bun (preferred; see `bun.lock`):
- `bun install`: install dependencies.
- `bun dev`: start the frontend on `http://localhost:3000`.
- `bun run dev:all`: run frontend + `convex dev` in parallel.
- `bun run dev:backend`: run Convex locally (`convex dev --tail-logs`).
- `bun run build` / `bun run serve`: production build and preview.
- `bun run type-check`: TypeScript checks (`tsc --noEmit`).
- `bun run check` (or `lint`/`format`): Biome format + lint with autofixes.

## Coding Style & Naming Conventions

- Language: TypeScript + React (TanStack Start).
- Formatting/linting: Biome (`biome.json`) with **tabs** indentation and double quotes.
- Generated files: avoid editing `src/routeTree.gen.ts` and `convex/_generated/*`.
- Data fetching: wrap Convex calls with `convexQuery(...)` (`@convex-dev/react-query`).
  - Prefer `useSuspenseQuery` for always-on queries; use `useQuery` only when conditional (`enabled`).
- React effects: use `useEffectEvent` for event callbacks that shouldn’t retrigger effects.

## Testing Guidelines

- Runner: Vitest (`bun test` / `bun run test`), with Testing Library available.
- Conventions: place tests next to code as `*.test.ts` / `*.test.tsx` (or `__tests__/`).

## Commit & Pull Request Guidelines

- Commits: follow the existing conventional prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `perf:`, `style:`.
- Config/secrets: never commit `.env`; use `.env.example` for documenting required vars and configure secrets in Convex/Vercel.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `PLANS.md`) from design to implementation.
