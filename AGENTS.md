# VDAB Databricks App Builder

This repository contains the Marketplace version of VDAB: a Databricks App that lets workspace users design, preview, and deploy Python/Streamlit applications in the workspace where the builder is installed. Keep code and documentation focused on this product.

## Project layout

- `src/databricks-app/` — Node.js/TypeScript server, Databricks App configuration, migrations, build scripts, and server tests.
- `src/client/` — React 19 client served by the installed App.
- `docs/` — maintained product, architecture, API, security, and operations guides.
- `src/databricks-app/.build/` — generated, self-contained deployment package; do not edit by hand.
- `docs/standards/` — repository engineering references.

Generated child applications use Python and Streamlit. Builder projects and deployment history persist in the Lakebase resource bound to the installed App.

## Architecture rules

The active request flow is:

```text
React client → Node HTTP boundary → application services → repositories → Lakebase
                                      ↘ workspace adapters, AI endpoints, and generator
```

- Keep HTTP handlers, application services, repositories, Databricks adapters, and code generation in their own boundaries.
- Handlers authenticate trusted App context, validate untrusted input, call a service, and map typed results to the versioned HTTP contract. Use same-origin `/api/v1` routes and RFC 9457 Problem Details.
- Services own rules and orchestration. Repositories own parameterized PostgreSQL and transaction boundaries. Workspace adapters own Databricks API calls.
- Use customer-owned Lakebase Autoscaling for durable builder state. Migrations are versioned and append-only.
- Use the acting user's forwarded Databricks authorization for user-triggered workspace actions. Do not retry a denied action with the App service principal.
- Derive workspace authority from trusted App runtime configuration. Never accept client-supplied workspace hosts, tokens, credentials, or connection identifiers as authority.
- Use strict TypeScript, `async`/`await`, `AbortSignal`, explicit types, and `unknown` for untrusted values. Do not use `any`, synchronous I/O, or unparameterized SQL.
- Keep generated Python deterministic and free of builder credentials.

Read [Node Databricks App architecture](docs/standards/node-databricks-app-architecture.md) before backend, Lakebase, workspace integration, or generator changes.

## React rules

- Use TanStack Query for fetched server state and React state/context for local UI state.
- Put raw resource HTTP functions in `src/api/`; wrap server-state access in one hook per resource under `src/hooks/`.
- Use React Router v7 Framework Mode with routes in `src/route-config/databricksRoutes.ts` and route modules in `src/pages/`.
- Use the existing shadcn/ui components and Tailwind CSS. Do not add another component library.
- Keep components, hooks, and utilities in separate files. Components use a read-only props parameter, one default export, semantic HTML, keyboard access, and visible loading/error states.
- API errors must reach the user through the existing toast or inline error UI; do not swallow them.

Read [frontend patterns](docs/standards/frontend-patterns.md) before modifying React code.

## General rules

- Prefer the smallest clear change. Avoid speculative abstractions and unrelated refactors.
- Validate input at the boundary; fail explicitly with typed outcomes. Keep public functions and complex types documented with JSDoc.
- Do not add third-party dependencies without a recorded security, license, maintenance, scope, and deployment-impact review and explicit user approval.
- Keep backend methods near 50 lines, service methods near 40 lines, files below 500 lines, and React components below 300 lines. If an in-scope change crosses a target, surface a focused refactor.
- Update relevant tests and product docs when behavior or contracts change. Tests belong beside their boundary: HTTP, services, repositories, workspace adapters, and generation.
- Keep user-facing pages responsive and accessible to WCAG 2.2 AA. Confirm destructive actions and protect unsaved edits.

## Build and local development

The supported package and install guide is the repository [README](docs/install.md). From the repository root:

```sh
cd src/databricks-app
npm run install:all
npm run build
npm run smoke
```

For local-only execution, set `VDAB_AUTH_MODE=local-test`, `VDAB_LOCAL_USER_ID=local-editor`, and `NODE_ENV=development`, then run `npm run start:packaged`. This adapter makes no Databricks requests.

Deploy only `src/databricks-app/.build/`. The build binds to `DATABRICKS_APP_PORT` when provided and serves the compiled client with the Node API.

## Documentation references

- [Node architecture](docs/standards/node-databricks-app-architecture.md)
- [Frontend patterns](docs/standards/frontend-patterns.md)
- [Product and engineering docs](docs/README.md)
