# Agent Knowledge Base

This document contains essential knowledge for AI agents working on this codebase, covering data fetching patterns, React hooks, and best practices.

## Data Fetching with Convex and TanStack Query

### Overview

This project uses **TanStack Start** with **Convex** as the backend. Data fetching is handled through `@convex-dev/react-query`, which bridges Convex queries with TanStack Query.

### `convexQuery` Function

**Purpose**: Wraps Convex API calls to work with TanStack Query.

**Import**:
```typescript
import { convexQuery } from "@convex-dev/react-query";
```

**Usage**:
```typescript
// In route loaders (server-side prefetching)
loader: async ({ context }) => {
  const { queryClient } = context;
  await queryClient.prefetchQuery(
    convexQuery(api.documents.getAll)
  );
}

// In components (client-side)
const { data: documents } = useSuspenseQuery(
  convexQuery(api.documents.getAll)
);
```

**Key Points**:
- Always use `convexQuery()` to wrap Convex API calls when using TanStack Query
- Works seamlessly with both `useQuery` and `useSuspenseQuery`
- Automatically handles query key generation and caching

---

## `useQuery` vs `useSuspenseQuery`

### When to Use `useSuspenseQuery`

**Use `useSuspenseQuery` when:**
- ✅ The query **always runs** (no conditional logic)
- ✅ You want better SSR/hydration support in TanStack Start
- ✅ You want simpler code (no manual loading state checks)
- ✅ Data is prefetched in route loaders
- ✅ You're okay with React Suspense boundaries handling loading states

**Import**:
```typescript
import { useSuspenseQuery } from "@tanstack/react-query";
```

**Example**:
```typescript
// ✅ Good: Always fetches documents
const { data: documents } = useSuspenseQuery(
  convexQuery(api.documents.getAll)
);

// No need for loading checks - data is always available
return (
  <div>
    {documents.map(doc => <div key={doc._id}>{doc.title}</div>)}
  </div>
);
```

**Benefits**:
- Better SSR/hydration support
- Simpler code (no `isLoading` or `undefined` checks)
- Works seamlessly with route loaders that prefetch data
- Automatic Suspense boundary integration

### When to Use `useQuery`

**Use `useQuery` when:**
- ✅ You need **conditional queries** (e.g., `enabled: !!documentId`)
- ✅ You need manual loading/error state handling
- ✅ The query might not run in some cases
- ✅ You need to handle loading states explicitly

**Import**:
```typescript
import { useQuery } from "@tanstack/react-query";
```

**Example**:
```typescript
// ✅ Good: Conditional query
const { data: isFavorite } = useQuery({
  ...convexQuery(
    api.favorites.isFavorite,
    documentId ? { documentId } : { documentId: "" as Id<"documents"> }
  ),
  enabled: !!documentId, // Only runs when documentId exists
});

// ✅ Good: Manual loading state handling
const { data: documents, isLoading, error } = useQuery(
  convexQuery(api.documents.getAll)
);

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
return <DocumentList documents={documents} />;
```

**Key Differences**:

| Feature | `useQuery` | `useSuspenseQuery` |
|---------|-----------|-------------------|
| Loading state | Manual (`isLoading`) | Automatic (Suspense) |
| Data availability | Can be `undefined` | Always available |
| Conditional queries | ✅ Supported (`enabled`) | ❌ Not supported |
| SSR/Hydration | Good | Excellent |
| Code complexity | Higher | Lower |

### Decision Tree

```
Is the query conditional?
├─ YES → Use `useQuery` with `enabled` option
└─ NO → Use `useSuspenseQuery`
    └─ Is data prefetched in route loader?
        ├─ YES → Use `useSuspenseQuery` ✅
        └─ NO → Still use `useSuspenseQuery` (better SSR support)
```

---

## `useEffect` vs `useEffectEvent`

### When to Use `useEffect`

**Use `useEffect` when:**
- ✅ You need to run side effects when dependencies change
- ✅ You need cleanup functions
- ✅ Standard React side effect patterns
- ✅ Dependencies are stable or you want the effect to re-run when they change

**Example**:
```typescript
// ✅ Good: Standard side effect
useEffect(() => {
  setIsMounted(true);
}, []); // Runs once on mount

// ✅ Good: Effect that should re-run when dependencies change
useEffect(() => {
  if (document?.content !== undefined) {
    documentContentRef.current = document.content;
  }
}, [document?.content]); // Re-runs when document.content changes
```

### When to Use `useEffectEvent`

**Use `useEffectEvent` when:**
- ✅ You want to **avoid re-running effects** when callback references change
- ✅ You're passing callbacks to external libraries or DOM events
- ✅ The callback uses values that change frequently, but you don't want the effect to re-run
- ✅ You want to read the latest value without adding it to dependencies

**Import**:
```typescript
import { useEffectEvent } from "react";
```

**Example**:
```typescript
// ✅ Good: Event handler that shouldn't cause effect re-runs
const onUpdateState = useEffectEvent(() => {
  const href = getCurrentLink(); // Reads latest value
  setLinkValue(href);
  setIsActive(editor.isActive("link", { href }));
});

useEffect(() => {
  editor.on("selectionUpdate", onUpdateState);
  editor.on("transaction", onUpdateState);
  
  return () => {
    editor.off("selectionUpdate", onUpdateState);
    editor.off("transaction", onUpdateState);
  };
}, [editor]); // onUpdateState is an Effect Event, doesn't need to be in dependencies
```

**Key Benefits**:
- Prevents unnecessary effect re-runs
- Always reads the latest values (closure-safe)
- Cleaner dependency arrays
- Better performance for frequently changing values

**Common Patterns**:

1. **Event Listeners with External Libraries**:
```typescript
const onEditorChange = useEffectEvent(
  (content: string, isSlashCommandActive?: boolean) => {
    onChange?.(content, isSlashCommandActive); // onChange might change frequently
  }
);

useEffect(() => {
  if (!editor) return;
  editor.on("update", ({ editor }) => {
    onEditorChange(editor.getHTML());
  });
  return () => {
    editor.off("update", onEditorChange);
  };
}, [editor]); // onChange not in deps, but always uses latest value
```

2. **Callbacks with Props**:
```typescript
// Parent passes onDragOver callback that might change
const onDragOverEvent = useEffectEvent((documentId: Id<"documents">) => {
  onDragOver?.(documentId); // Always uses latest onDragOver
});

useEffect(() => {
  if (isOver && !isExpanded && hasChildren && onDragOver) {
    setIsExpanded(true);
    onDragOverEvent(document._id);
  }
}, [isOver, isExpanded, hasChildren, document._id, onDragOver]);
// onDragOverEvent doesn't need to be in deps
```

3. **Computed Values**:
```typescript
const computeIsActive = useCallback(() => {
  return editor.isActive("subscript") || editor.isActive("superscript");
}, [editor]);

const onUpdate = useEffectEvent(() => {
  setIsActive(computeIsActive()); // Always uses latest computeIsActive
});

useEffect(() => {
  editor.on("selectionUpdate", onUpdate);
  return () => editor.off("selectionUpdate", onUpdate);
}, [editor]); // computeIsActive not in deps
```

### Decision Tree

```
Do you need to avoid re-running the effect when a callback/prop changes?
├─ YES → Use `useEffectEvent` for the callback
│   └─ Is it an event handler for external library?
│       ├─ YES → Use `useEffectEvent` ✅
│       └─ NO → Still use `useEffectEvent` if callback changes frequently
└─ NO → Use regular `useEffect`
    └─ Do dependencies change and you want effect to re-run?
        ├─ YES → Use `useEffect` with dependencies ✅
        └─ NO → Use `useEffect` with empty deps []
```

### Important Notes

1. **`useEffectEvent` is React 19+**: Make sure you're using React 19 or later
2. **Always use latest values**: `useEffectEvent` always reads the latest closure values
3. **Don't add to dependencies**: Effect Events don't need to be in dependency arrays
4. **Type safety**: TypeScript will help catch misuse

---

## Best Practices Summary

### Data Fetching
- Use `convexQuery()` for all Convex API calls with TanStack Query
- Prefer `useSuspenseQuery` for non-conditional queries
- Use `useQuery` only when you need conditional queries or manual loading states
- Prefetch data in route loaders for better SSR performance

### Side Effects
- Use `useEffect` for standard side effects with stable dependencies
- Use `useEffectEvent` for callbacks that change frequently but shouldn't trigger effect re-runs
- Always include cleanup functions for subscriptions and event listeners

### Code Quality
- Remove unnecessary null checks when using `useSuspenseQuery`
- Keep dependency arrays minimal and accurate
- Use TypeScript for type safety
- Do NOT add redundant comments that describe what the next line does
- Do NOT add JSDoc comments unless they provide API documentation
- Only add comments when the code's intent is non-obvious or requires context

---

## Examples from Codebase

### Good: Using `useSuspenseQuery`
```typescript
// src/components/chat-input.tsx
const { data: documents } = useSuspenseQuery(
  convexQuery(api.documents.getAll)
);

// No loading checks needed - data is always available
const availableDocuments = useMemo(() => {
  return documents.filter((doc) => !mentions.includes(doc._id));
}, [documents, mentions]);
```

### Good: Using `useQuery` for Conditional Query
```typescript
// src/components/nav-actions.tsx
const { data: isFavorite } = useQuery({
  ...convexQuery(
    api.favorites.isFavorite,
    documentId ? { documentId } : { documentId: "" as Id<"documents"> }
  ),
  enabled: !!documentId, // Only runs when documentId exists
});
```

### Good: Using `useEffectEvent` for Event Handlers
```typescript
// src/components/nav-documents.tsx
const onDragOverEvent = useEffectEvent((documentId: Id<"documents">) => {
  onDragOver?.(documentId); // Always uses latest onDragOver
});

useEffect(() => {
  if (isOver && !isExpanded && hasChildren && onDragOver) {
    setIsExpanded(true);
    onDragOverEvent(document._id);
  }
}, [isOver, isExpanded, hasChildren, document._id, onDragOver]);
// onDragOverEvent is an Effect Event, doesn't need to be in dependencies
```

### Good: Using `useEffect` for Standard Side Effects
```typescript
// src/components/nav-documents.tsx
useEffect(() => {
  setIsMounted(true);
}, []); // Runs once on mount
```

---

## References

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [Convex React Query Integration](https://github.com/convex-dev/react-query)
- [React useEffectEvent Documentation](https://react.dev/reference/react/useEffectEvent)
- [React useEffect Documentation](https://react.dev/reference/react/useEffect)
