# Performance and caching improvements (TanStack Start + Convex)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the repo root. This document must be maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, the app feels fast even with many documents and workspaces. Navigation and sidebar rendering should not trigger an explosion of network calls, and common screens (home, documents, search, chat mentions) should load with smaller payloads and fewer refetches. You can observe this by opening the browser network panel, expanding/collapsing pages in the sidebar, opening the command palette/search, and logging in/out; the number of requests and payload sizes should be noticeably reduced.

## Progress

- [x] (2025-12-29) Establish baseline observations (qualitative: sidebar expansion triggered many child queries; workspace creation invalidated all queries; multiple call sites fetched full documents list).
- [x] (2025-12-29) Remove broad invalidation on workspace creation; rely on reactive Convex subscriptions for updates.
- [x] (2025-12-29) Eliminate N+1 sidebar queries by fetching children only when expanded (documents + shared).
- [x] (2025-12-29) Add lightweight document index query (small fields) and replace `documents.getAll` call sites that only needed titles/icons/search lists.
- [x] (2025-12-29) Add/adjust Convex indexes and query patterns to avoid `.filter` where possible (especially documents tree queries).
- [x] (2025-12-29) Add missing `returns:` validators to Convex auth functions for safer typing and clearer API contracts.
- [x] (2025-12-29) Align TanStack Start data loading with TanStack Query caching patterns (`ensureQueryData` in loaders; rely on reactive updates instead of manual invalidation).
- [x] (2025-12-29) Add optimistic updates for favorites to keep UI responsive without invalidation.
- [x] (2025-12-29) Tune `gcTime` for expensive, bursty subscriptions (sidebar children) so they disconnect quickly after collapse.
- [x] (2025-12-29) Validation: regenerated Convex bindings, ran `bun run check` + `bun run type-check`.

## Surprises & Discoveries

- Observation: The app sets TanStack Query `staleTime: Infinity` globally in `src/router.tsx`, so “slowness” is mainly caused by too many queries/payload sizes and broad invalidation, not a lack of caching.
  Evidence: `src/router.tsx` QueryClient `defaultOptions.queries.staleTime = Number.POSITIVE_INFINITY`.
- Observation: With `@convex-dev/react-query`, Convex query results update reactively; most `invalidateQueries(...)` calls were unnecessary and increased work.
  Evidence: Removed invalidations across sidebar and document UI without breaking correctness; remaining invalidation is limited to the Better Auth profile update path.

## Decision Log

- Decision: Prefer reducing query count and payload size over increasing cache durations.
  Rationale: The app already caches aggressively; fewer requests and smaller responses improve both cold and warm performance.
  Date/Author: 2025-12-29 / Codex
- Decision: Prefer reactive Convex subscriptions over manual invalidation; use optimistic updates for “instant feedback” UX.
  Rationale: Convex pushes consistent query updates to the client; invalidation adds unnecessary refetch/re-render churn. Optimistic updates preserve snappy toggles without reintroducing invalidation.
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

This pass focuses on reducing request counts and payload sizes rather than increasing cache lifetimes, and aligning with Convex reactive query semantics (no manual invalidation). Likely follow-ups are pagination for extremely large workspaces and further backend query shaping to avoid loading large lists for UI-only needs.

## Context and Orientation

This is a TanStack Start (TanStack Router + TanStack Query) frontend in `src/` and a Convex backend in `convex/`.

Important files and concepts:

- `src/router.tsx` creates the TanStack Query `QueryClient` and sets global query defaults (including caching).
- `src/routes/*` are TanStack Router file-based routes. Many route loaders currently “prefetch” Convex queries via TanStack Query.
- `src/components/nav-documents.tsx` and `src/components/nav-shared.tsx` render the sidebar trees; today they eagerly fetch children for every visible node, causing an N+1 query pattern.
- `convex/schema.ts` defines tables and indexes. Query performance depends heavily on using indexes rather than filtering.
- `convex/documents.ts` contains most read paths. Several queries use `.filter` to apply `isArchived` constraints; this plan adds composite indexes so these constraints can be expressed with `withIndex(...)`.
- `convex/workspaces.ts` contains workspace APIs; workspace creation currently triggers broad cache invalidation in the UI.

Definitions used in this plan:

- “N+1 query pattern”: a UI renders a list of N items and issues an additional query per item (N more queries). This grows linearly with list size and feels slow.
- “Targeted invalidation”: invalidating only the exact cached queries that are affected by a mutation, instead of invalidating all queries.
- “Lightweight index query”: a query that returns only the fields needed by the UI (e.g. `_id`, `title`, `icon`), not full document content.

## Plan of Work

First, reduce unnecessary refetching by replacing `invalidateQueries()` calls that have no query key filter with targeted invalidations and/or direct cache updates.

Second, remove the N+1 query pattern in the sidebar trees by loading children only when a node is expanded. While loading, show a small inline loading affordance; do not block rendering the rest of the sidebar.

Third, introduce a new Convex query that returns a minimal “document index” list scoped to the active workspace (IDs, titles, icons, parent IDs, timestamps). Replace frontend call sites that currently fetch `documents.getAll` solely to build title maps or populate search/mention pickers.

Fourth, update Convex schema and queries to avoid `.filter` for hot paths. Add composite indexes (e.g. `workspaceId + parentId + isArchived`) and migrate relevant `documents.ts` queries to use them via `withIndex(...)`.

Fifth, improve Convex API clarity by adding missing `returns:` validators, especially in `convex/auth.ts`, using `v.any()` where the payload is dynamic.

Finally, align route loaders with TanStack Query caching by using `ensureQueryData` where appropriate, and ensure query keys remain stable and invalidations are scoped.

## Concrete Steps

Run commands from the repository root:

1) Code health:

    bun run check
    bun run type-check

2) Manual verification (dev server):

    bun run dev:all

Then verify in the browser:

- Open the Network tab.
- Expand/collapse several nodes in the sidebar; confirm children are fetched only when expanded.
- Open search/mentions UI; confirm it does not fetch full document bodies for all documents.
- Create a new workspace; confirm the UI does not “refetch everything”.

## Validation and Acceptance

Acceptance is behavioral:

- Expanding the sidebar tree does not trigger an N+1 burst of requests; children load on demand.
- “Search pages” and mention pickers do not require `documents.getAll` (full document payload) to function.
- Creating a workspace triggers only minimal, relevant refetches (workspaces list and workspace-scoped lists), not a global refetch of unrelated queries.
- Convex queries for hot paths use indexes rather than `.filter` where indexes can represent the constraints.
- `bun run check` and `bun run type-check` pass.

## Idempotence and Recovery

These steps are safe to repeat. If an index migration causes a logic regression, revert query changes back to the previous index and re-run type-check. If a schema/index change needs rollback, remove the new index definitions and re-run Convex codegen before starting the dev server.

## Artifacts and Notes

Keep brief notes here for any large refactors:

- List of newly added indexes in `convex/schema.ts`.
- Names of newly added lightweight queries (e.g. `api.documents.listIndex`).

## Interfaces and Dependencies

This plan depends on:

- TanStack Start + TanStack Router + TanStack Query (already in `package.json`).
- `@convex-dev/react-query` and `convex/react` for Convex integration.

At the end of this work, the following interfaces must exist:

- In `convex/documents.ts`, a query that returns a lightweight list of documents for a workspace (IDs/titles/icons/parent IDs/updated timestamps).
- In `convex/schema.ts`, composite indexes needed to support the above and to remove `.filter` on hot queries.
- In the sidebar components, child document queries must be conditional on “expanded” state (no eager per-node child fetch).

## Plan revision notes

Initial plan created on 2025-12-29. Updated after implementation to reflect completed milestones, then updated again to reflect the removal of redundant invalidations, addition of optimistic favorites, and `gcTime` tuning.
