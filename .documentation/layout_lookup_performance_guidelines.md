# Layout Lookup Performance Guidelines

## Purpose

This document captures a frontend performance issue we hit in layout/rendering code, how we fixed it, and how to avoid reintroducing it in future layout implementations (Tabs, Form, Rows/Columns, future containers).

## Issue Summary

We had repeated nested lookup patterns like:

- `children.map(id => allComponents.find(...))`
- repeated `array.includes(...)` checks inside loops

These patterns are simple, but they become expensive as component trees grow.

## Why It Was a Problem

When a loop (`k` items) performs a linear search over another list (`n` items), complexity becomes:

- $O(k \cdot n)$

If this runs during render, drag/drop calculations, or repeated operations, it can noticeably increase UI work as apps get larger.

## How We Avoided It

We replaced nested linear lookups with one-time indexes:

- Build a `Map<string, Component>` once
- Build grouped lookup maps (e.g., `Map<number, Component[]>` for `tabIndex`)
- Use `Set` for membership checks instead of repeated `includes`

Typical complexity change:

- Before: $O(k \cdot n)$
- After: build index $O(n)$ + lookups $O(k)$ = $O(n + k)$

## Applied Examples (Current Code)

### Renderers

- `TabsRenderer.tsx`
  - Added `componentsById` and `childrenByTabIndex` memoized indexes
  - Replaced per-render nested `find` with map access

- `FormRenderer.tsx`
  - Added `allComponentsById`
  - Replaced `children.map(...find...)` with `children.map(...get...)`

- `RowsRenderer.tsx` / `ColumnsRenderer.tsx`
  - Added `allComponentsById`
  - Replaced per-slot `find` with `Map.get`

### Operations / Utilities

- `useComponentOperations.ts`
  - Added `contextComponentsById`
  - Replaced repeated `contextComponents.find(...)` in add/insert paths

- `componentMoveUtils.ts`
  - Added `allComponentsById`
  - Replaced repeated `allComponents.find(...)` in parent insert logic

- `sortableUtils.ts`
  - Added `allComponentsById` in form sorting branch
  - Replaced repeated `find` while building sortable child model

## Implementation Pattern (Use This)

```ts
const byId = new Map(items.map((item) => [item.id, item]));

const resolved = ids
  .map((id) => byId.get(id))
  .filter((item): item is ItemType => item !== undefined);
```

For grouped layout containers (e.g., tabs):

```ts
const byGroup = new Map<number, ItemType[]>();
for (const item of resolved) {
  const group = getGroup(item);
  const existing = byGroup.get(group);
  if (existing) existing.push(item);
  else byGroup.set(group, [item]);
}
```

For membership checks:

```ts
const idSet = new Set(ids);
if (idSet.has(candidateId)) { ... }
```

## Rules for Future Layout Implementations

1. Never use `find` inside a loop over ids/components when a map can be built once.
2. Never use repeated `includes` in hot paths; use `Set`.
3. For render paths, memoize indexes with `useMemo`.
4. For operation helpers/utilities, build indexes once per function call.
5. Keep ordering logic explicit (`layout.y`, `tabIndex`, etc.), but resolve entities through maps.
6. If adding a new container layout type, define:
   - id index strategy (`Map`)
   - grouping strategy (`Map<groupKey, children[]>`)
   - membership strategy (`Set`)

## PR Review Checklist (Performance)

- [ ] Any `map(...find...)` or `forEach(...find...)` pattern removed from hot path
- [ ] Any repeated `includes(...)` in loops replaced by `Set.has(...)`
- [ ] Index/group maps built once and reused
- [ ] Behavior unchanged (same ordering semantics)
- [ ] Focused tests pass

## Notes

This guidance is specifically important for:

- layout renderers (`Tabs`, `Form`, `Rows`, `Columns`)
- drag/drop insertion computations
- sorting/reindexing helpers
- any code that runs every render or during drag interactions
