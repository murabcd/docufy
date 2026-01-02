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
  - Convex queries via React Query are live subscriptions; avoid `queryClient.invalidateQueries(...)` by default (reactive updates handle it). Use invalidation only for non-Convex state (e.g. Better Auth profile updates) or when a query is proven non-reactive/derived.
  - For bursty/expensive subscriptions (e.g. sidebar children, modal lists), set a smaller `gcTime` (commonly `10_000`) so subscriptions disconnect shortly after unmount.
  - Convex subscriptions are never “stale” in TanStack Query (`isStale` is always false); `retry` and `refetch*` options are generally ignored (Convex has its own retry + pushes updates reactively).
  - Avoid N+1 query patterns in UI trees: fetch children only when expanded (`enabled`) and use `placeholderData: (prev) => prev ?? []` for smooth transitions.
  - Prefer lightweight/index queries (minimal fields) for lists/search/pickers; avoid fetching full document bodies when only IDs/titles/icons are needed.
  - Prefer centralized query option factories in `src/queries/*` over inline `convexQuery(...)` calls; use the same factories in route loaders via `queryClient.ensureQueryData(...)`.
  - It’s OK to mix `@convex-dev/react-query` queries with `convex/react` hooks/mutations in the same app (they share the same Convex client).
- React effects: use `useEffectEvent` for event callbacks that shouldn’t retrigger effects.

### Auth & Access Patterns

- Auth gating: use Convex auth state (`<Authenticated/>`, `<Unauthenticated/>`, `<AuthLoading/>`, or `useConvexAuth()`) to decide whether to show UI / run authenticated queries; don’t rely on Better Auth session state for Convex call readiness.
- Guest/anonymous UX: don’t render controls that would trigger authenticated Convex queries/mutations, and ensure conditional queries never run with placeholder IDs like `"default"`.

### Convex Backend Conventions

- Functions: use the “new function syntax” (`query({ args, returns, handler })`, `mutation({ ... })`) and include `returns:` validators.
- Schema: add indexes for hot paths instead of `.filter(...)` when possible; name indexes as `by_<field1>_and_<field2>` in index field order.
- After changing Convex functions/schema: run `bunx convex codegen` to regenerate types/bindings.

## Testing Guidelines

- Runner: Vitest (`bun test` / `bun run test`), with Testing Library available.
- Conventions: place tests next to code as `*.test.ts` / `*.test.tsx` (or `__tests__/`).

## Commit & Pull Request Guidelines

- Commits: follow the existing conventional prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `perf:`, `style:`.
- Config/secrets: never commit `.env`; use `.env.example` for documenting required vars and configure secrets in Convex/Vercel.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `.agent/PLANS.md`) from design to implementation.
