# Frontend Patterns
**Last Updated:** 11 June 2026  

Concrete reference patterns for the React frontend. Read when implementing or modifying a React component, custom hook, model class, API module, or context.

Rules live in [`AGENTS.md`](../../AGENTS.md). This file only shows the patterns those rules produce.

---

## Folder Layout

Flat and **role-based** — group files by what they are, not by feature. The role folders are the same in every router mode; only the top-level directory and routing entry files change (see note below).

```
src/                      # `app/` in React Router framework mode
├── api/                  # HTTP client + one fetcher module per backend resource (the queryFns)
├── assets/               # Static images, fonts, icons
├── components/
│   ├── ui/               # shadcn/ui primitives
│   └── ...               # shared components
├── context/              # React Context units — context + provider + hook, one unit per file
├── hooks/                # Custom hooks — TanStack Query server-state hooks + UI hooks, one per file
├── layouts/              # Page shells (MainLayout, AuthLayout)
├── lib/                  # Third-party client setup (queryClient, …)
├── models/               # Data: interfaces + classes mirroring backend
├── pages/                # Route-level components — one per route
├── types/                # UI-only types, enums, event shapes
├── utils/                # Purpose-grouped utility modules
├── App.tsx
└── main.tsx
```

**Router mode sets the routing files.** Use the current React Router major (v7); pick the [mode](https://reactrouter.com/start/modes) per project. Declarative/Data mode use `src/`, a router file, `App.tsx`, and `main.tsx`. **Framework mode** roots the app at `app/` and replaces `pages/` + the entry files with `root.tsx`, `routes.ts`, and a `routes/` folder of route modules. Everything else above is identical either way.

---

## Component

```tsx
// src/components/PolicyCard.tsx
import type { IPolicy } from "@/models/Policy";

interface IPolicyCardProps {
  policy: IPolicy;
  onEdit?: (id: number) => void;
}

function PolicyCard({ policy, onEdit }: Readonly<IPolicyCardProps>) {
  return (
    <article className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">{policy.name}</h3>
      <p className="text-sm text-muted-foreground">{policy.formattedEffectiveDate}</p>
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(policy.id)}
          aria-label={`Edit policy ${policy.name}`}
        >
          Edit
        </button>
      )}
    </article>
  );
}

export default PolicyCard;
```

Rules: `interface I<Component>Props` above, `Readonly<...>` on the parameter, exactly one default export matching the filename. Props reference `src/models` types — they do not redefine them.

Either `function ComponentName(...)` declaration or `const ComponentName = () => ...` arrow form is acceptable; match the surrounding file.

## Component with State

```tsx
import { useState } from "react";

interface IPolicyFilterProps {
  initialQuery?: string;
  onChange: (query: string) => void;
}

function PolicyFilter({ initialQuery = "", onChange }: Readonly<IPolicyFilterProps>) {
  const [query, setQuery] = useState(initialQuery);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    onChange(next);
  }

  return (
    <input
      type="search"
      value={query}
      onChange={handleChange}
      placeholder="Filter policies"
      aria-label="Filter policies"
    />
  );
}

export default PolicyFilter;
```

`useState` and `useContext` are the state primitives. No Redux / MobX / Zustand without dependency approval.

## When to Extract

A component file violates the rules if it contains:

- A second top-level component (unless trivial, ≤ ~20 LOC, single-use). Extract.
- A custom hook (`useXxx`). Move to `src/hooks/`.
- Reusable utility functions. Move to a purpose-named file in `src/utils/`.

When extending a file that already mixes concerns, split the violations out as part of the same change. Do not add to the pile.

---

## Custom Hook

Custom hooks come in two kinds:

- **Server-state hooks** — fetching/caching entities, lookups, and DTOs. These use **TanStack Query** (see [Server State](#server-state-tanstack-query)); they wrap the `api/` fetchers and own a query-key factory. Do **not** hand-roll `useState` + `useEffect` + `fetch` for server data.
- **UI hooks** — local interaction logic with no server data (e.g. `usePagination`, `useDisclosure`). Plain `useState`/`useReducer`/`useContext`.

A server-state hook:

```ts
// src/hooks/usePolicies.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPolicies, createPolicy } from "@/api/policies";
import { Policy } from "@/models/Policy";
import type { ICreatePolicyRequest } from "@/models/CreatePolicyRequest";

// Query-key factory — most generic → most specific. Colocated with the hooks that use it.
export const policyKeys = {
  all: ["policies"] as const,
  lists: () => [...policyKeys.all, "list"] as const,
  list: (filters: string) => [...policyKeys.lists(), { filters }] as const,
  details: () => [...policyKeys.all, "detail"] as const,
  detail: (id: number) => [...policyKeys.details(), id] as const,
};

export function usePolicies() {
  return useQuery({
    queryKey: policyKeys.lists(),
    queryFn: listPolicies,
    select: (raw) => raw.map((p) => new Policy(p)),
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ICreatePolicyRequest) => createPolicy(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: policyKeys.lists() }),
  });
}
```

`useQuery` returns `{ data, isPending, isError, error, … }` — the loading/error/refetch state comes from TanStack Query, not hand-rolled `useState`. One file per entity; the query-key factory lives beside the hooks that use it. Hooks are named exports.

---

## Server State (TanStack Query)

All server data — entities, lookups, DTOs — is managed by **TanStack Query** (`@tanstack/react-query`, v5), the approved standard for server/async state. `useState`/`useContext` are for **client/UI** state only.

Create one `QueryClient` with sensible defaults and mount the provider at the app root:

```ts
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // tune per project
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

```tsx
// src/main.tsx  (framework mode: app/root.tsx)
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>;
```

Rules:

- **Query/mutation hooks live in `src/hooks/`**, one file per entity, each owning its query-key factory (see [Custom Hook](#custom-hook)). Raw fetchers stay in `src/api/` and serve as the `queryFn`.
- **Query keys come from a factory**, arrays ordered most-generic → most-specific. Invalidate by the narrowest key that covers the change (`policyKeys.lists()` after a create).
- **Mutations invalidate (or set) the affected queries** in `onSuccess` — don't refetch by hand.
- Components read `isPending`/`isError`/`data` from the hook for loading and error UI; network errors still surface via the `http` client's toast.
- v5's `queryOptions` helper is the type-safe way to share a query definition across hooks/prefetches when needed.
- **Framework mode (SSR):** prefetch on the server and hand state to the client via `dehydrate` + `<HydrationBoundary>`; a plain SPA doesn't need this.
- Add `@tanstack/react-query-devtools` in development builds only.

---

## Model (interface + class)

```ts
// src/models/Policy.ts
export interface IPolicy {
  id: number;
  name: string;
  effectiveDate: Date;
  status: PolicyStatus;
  ownerId: number;
  readonly formattedEffectiveDate: string;
}

import { PolicyStatus } from "@/types/policy";

export class Policy implements IPolicy {
  id: number;
  name: string;
  effectiveDate: Date;
  status: PolicyStatus;
  ownerId: number;

  constructor(source: Partial<IPolicy> = {}) {
    this.id = source.id ?? 0;
    this.name = source.name ?? "";
    this.effectiveDate =
      source.effectiveDate instanceof Date
        ? source.effectiveDate
        : new Date(source.effectiveDate ?? Date.now());
    this.status = source.status ?? PolicyStatus.Draft;
    this.ownerId = source.ownerId ?? 0;
  }

  get formattedEffectiveDate(): string {
    return this.effectiveDate.toLocaleDateString();
  }
}
```

Rules: interface declares the contract; class provides defaults, date parsing, and computed properties. Components consume `IPolicy` in props; the class is used when instantiating from API payloads.

## Request Model

```ts
// src/models/CreatePolicyRequest.ts
export interface ICreatePolicyRequest {
  name: string;
  effectiveDate: Date;
}

export class CreatePolicyRequest implements ICreatePolicyRequest {
  name: string;
  effectiveDate: Date;

  constructor(source: Partial<ICreatePolicyRequest> = {}) {
    this.name = source.name ?? "";
    this.effectiveDate = source.effectiveDate ?? new Date();
  }

  isValid(): boolean {
    return this.name.trim().length > 0;
  }
}
```

UI and API models for the same entity share a name and stay close in shape.

---

## Types

```ts
// src/types/policy.ts
export enum PolicyStatus {
  Draft = "Draft",
  Active = "Active",
  Expired = "Expired",
  Cancelled = "Cancelled",
}

export interface IPolicyTableColumn {
  key: keyof IPolicy;
  label: string;
  sortable?: boolean;
}
```

UI-only configuration, enums, and event shapes live in `src/types`. If a type is used by only a single component, inline it in that component instead.

---

## API Module

```ts
// src/api/policies.ts
import { http } from "@/api/http";
import type { IPolicy } from "@/models/Policy";
import type { ICreatePolicyRequest } from "@/models/CreatePolicyRequest";

const base = "/api/policies";

export async function listPolicies(): Promise<IPolicy[]> {
  return http.get<IPolicy[]>(base);
}

export async function getPolicy(id: number): Promise<IPolicy> {
  return http.get<IPolicy>(`${base}/${id}`);
}

export async function createPolicy(request: ICreatePolicyRequest): Promise<IPolicy> {
  return http.post<IPolicy>(base, request);
}
```

One module per backend resource. Functions are named exports. These are the raw fetchers — the `queryFn`s that the TanStack Query hooks in `src/hooks/` wrap (see [Server State](#server-state-tanstack-query)). Errors propagate — the `http` client surfaces them via toast/snackbar; do not swallow them silently in the API module.

## HTTP Client (shape only)

```ts
// src/api/http.ts
import { toast } from "@/components/ui/use-toast";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({ title: response.statusText }));
    toast({ title: "Request failed", description: problem.detail ?? problem.title, variant: "destructive" });
    throw new Error(problem.detail ?? problem.title ?? "Request failed");
  }

  return (await response.json()) as T;
}

export const http = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put:  <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};
```

User-facing errors surface via toast. Network failures throw so calling hooks/components can react.

---

## Context

```tsx
// src/context/CurrentUserContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import type { IApplicationUser } from "@/models/ApplicationUser";

interface ICurrentUserContext {
  user: IApplicationUser | null;
  setUser: (user: IApplicationUser | null) => void;
}

const CurrentUserContext = createContext<ICurrentUserContext | undefined>(undefined);

interface ICurrentUserProviderProps {
  children: ReactNode;
}

export function CurrentUserProvider({ children }: Readonly<ICurrentUserProviderProps>) {
  const [user, setUser] = useState<IApplicationUser | null>(null);
  return (
    <CurrentUserContext.Provider value={{ user, setUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): ICurrentUserContext {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return ctx;
}
```

Provider + hook live in the same file because they form a single coherent unit. The hook throws when used outside the provider — that's an actual programming error, not a user-facing failure.

---

## Utility Module

```ts
// src/utils/dateFormatting.ts
export function formatLongDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatRelativeTime(value: Date | string): string {
  // ...
  return "";
}
```

Files in `src/utils/` group by a single purpose. No `helpers.ts`, no `utils.ts`, no `misc.ts`. Split when a file grows beyond a single coherent purpose.

---

## Accessibility Checklist

Every interactive component should meet these before the first PR:

- Semantic element (`<button>`, `<nav>`, `<header>`, `<main>`, `<form>`) over generic `<div>` / `<span>`.
- Keyboard reachable and operable. `Tab` order makes sense; `Enter`/`Space` activate buttons.
- Visible focus state (do not remove the focus ring without a replacement).
- `aria-label` on icon-only buttons.
- `alt` on `<img>` (empty `alt=""` for decorative images).
- Color contrast meets WCAG 2.2 AA (4.5:1 body text, 3:1 large text and UI components).
- Loading and error states have visible, accessible feedback (not just a spinner with no label).
- Destructive actions have a confirmation step.

---

## UX Baseline

Build these in from the start; do not defer them:

- Responsive layout works at mobile, tablet, and desktop widths.
- Visible loading state for any async action.
- Visible error state for any failure path, surfaced via toast/snackbar.
- Navigation guard when the user has unsaved changes.
- Confirmation dialog before destructive actions.
- Empty states have a clear message and (where applicable) a primary action.
