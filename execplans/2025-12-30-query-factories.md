# Centralize Convex query option factories (TanStack Start + Convex)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the repo root. This document must be maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, all Convex+TanStack Query subscriptions are created through a small set of shared “query option factory” functions (like the official `start-convex-trellaux` example). This improves consistency (stable query keys), makes loader prefetching simpler, and reduces copy/paste drift across the codebase.

You can observe this by searching the repo for `convexQuery(`: most application code should use `src/queries/*` helpers instead of constructing query options inline.

## Progress

- [x] (2025-12-30) Add query option factory modules under `src/queries/` for the app’s major Convex domains (auth, workspaces, documents, favorites, chats).
- [x] (2025-12-30) Migrate existing `convexQuery(...)` call sites in routes/components/hooks to use the factory functions.
- [x] (2025-12-30) Update route loaders to use `queryClient.ensureQueryData` with the same factory functions.
- [x] (2025-12-30) Validation: run `bun run check` and `bun run type-check`.

## Surprises & Discoveries

- Observation: The codebase currently mixes inline `convexQuery(api.x.y, ...)` calls across many files, which risks key/arg drift and makes targeted caching tweaks harder.
  Evidence: `rg "convexQuery\\(" src` yields many independent constructions.
- Observation: `rg "convexQuery\\(" src` will always include the `src/queries/*` factory modules themselves.
  Evidence: the factories are thin wrappers around `convexQuery(...)` by design; the acceptance criteria is that application code (routes/components/hooks) no longer constructs query options inline.
- Observation: Biome may refuse to apply unused import removals as “unsafe” even during `biome check --write`.
  Evidence: `bun run check` flagged an unused `convexQuery` import in `src/routes/__root.tsx` and required a manual edit.

## Decision Log

- Decision: Start with query factories only (no global migration to TanStack `useMutation` wrappers).
  Rationale: Query factories are the highest-value, lowest-risk improvement and match the official example’s “queries.ts” pattern without forcing a large mutation refactor.
  Date/Author: 2025-12-30 / Codex

## Outcomes & Retrospective

- Outcome: Application code no longer constructs Convex query options inline; it imports `authQueries`, `documentsQueries`, `workspacesQueries`, `favoritesQueries`, `chatsQueries` from `src/queries/*`.
- Outcome: Loader prefetching uses the same shared query factories, matching the official `start-convex-trellaux` pattern.
- Validation: `bun run check` and `bun run type-check` pass.

## Context and Orientation

Key files:

- `src/router.tsx`: creates the `QueryClient` and wires `ConvexQueryClient` to it.
- `src/routes/*`: uses route `loader` to prefetch/ensure query data.
- Convex query option objects are created via `convexQuery` from `@convex-dev/react-query`.

Definition:

- “Query option factory”: a function that returns the `convexQuery(api.someQuery, args)` object. This can be passed to `useQuery`, `useSuspenseQuery`, `prefetchQuery`, or `ensureQueryData`.

## Plan of Work

1) Create a new `src/queries/` folder.

2) Add a small set of query factory modules:

- `src/queries/auth.ts`: `authQueries.currentUser()`, plus any other auth queries used by UI.
- `src/queries/workspaces.ts`: `workspacesQueries.mine()`.
- `src/queries/documents.ts`: factories for `get`, `list`, `listShared`, `getTrash`, `getRecentlyUpdated`, `listIndex`, `search`, `getPublished`, `getAncestors`.
- `src/queries/favorites.ts`: factories for `listWithDocuments`, `isFavorite`.
- `src/queries/chats.ts`: factories for `list`, `messages` if used.
- `src/queries/index.ts`: re-export all factories.

3) Replace inline `convexQuery(api...` usages in `src/routes`, `src/components`, `src/hooks` with imports from `src/queries/*`.

4) Update loaders to call `ensureQueryData(factory(...))`.

## Concrete Steps

From repo root:

    bun run check
    bun run type-check

Optional “spot check”:

    rg -n "convexQuery\\(" src --glob '!src/queries/**'

## Validation and Acceptance

- Most app code no longer calls `convexQuery(...)` directly; it uses `src/queries/*` factories.
- Route loaders use `ensureQueryData(...)` with the same factories used by components.
- `bun run check` and `bun run type-check` pass.

## Idempotence and Recovery

This change is safe to repeat. If a migration breaks, revert the affected file to inline `convexQuery(...)` temporarily and re-run type-check, then fix the factory signatures.

## Artifacts and Notes

- `src/queries/*` is the primary artifact; keep the API minimal and stable.

## Interfaces and Dependencies

At the end, these exports must exist:

- `src/queries/auth.ts`: `authQueries`
- `src/queries/workspaces.ts`: `workspacesQueries`
- `src/queries/documents.ts`: `documentsQueries`
- `src/queries/favorites.ts`: `favoritesQueries`
- `src/queries/chats.ts`: `chatsQueries`
- `src/queries/index.ts`: re-exports

## Plan revision notes

Initial plan created on 2025-12-30.
