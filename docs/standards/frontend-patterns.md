# Marketplace App frontend patterns

These patterns apply to the React client in `src/client/`. The client runs as part of the installed Databricks App and talks to its same-origin Node API.

## Application structure

- Keep route declarations in `src/routes.ts`; route modules and layouts live under `src/route-config/` and `src/layouts/`.
- Keep components in `src/components/`, resource hooks in `src/hooks/`, pure HTTP functions in `src/api/`, API and domain data shapes in `src/models/`, and code-only shared types in `src/types/`.
- Components render UI and handle interaction. Hooks coordinate client state or server state. API modules make HTTP requests. Do not make a component assemble API URLs or perform unrelated domain work.
- Keep the current-workspace boundary explicit in names and calls. User-driven Databricks resource reads use `/api/v1/workspace/...`; the server resolves the installed workspace and forwards the signed-in user's authorization.

## React and TypeScript

- Use strict TypeScript, `unknown` for untrusted values, and narrow values at runtime. Avoid `any`.
- Give each component a props interface above the component, wrap the parameter type in `Readonly`, and keep one main component per file.
- Put reusable hooks in one file each and name them `useThing`.
- Keep functions and components focused. Split a unit when it grows beyond the targets in `AGENTS.md`.
- Use semantic HTML, accessible labels, keyboard support, and visible loading and error states.

## Server state and HTTP

- Use TanStack Query for API-backed data. Put the raw request in `src/api/` and its query or mutation hook in `src/hooks/`.
- Keep each query key with its resource hook. Mutations update or invalidate the affected keys.
- Use same-origin `/api/v1` endpoints and `credentials: "same-origin"`. Pass `AbortSignal` through fetchers when provided by TanStack Query.
- Parse JSON responses from `unknown` and reject malformed responses. Surface errors through the relevant page or component state; do not silently swallow them.
- Do not add access tokens, workspace hosts, service credentials, or workspace connection IDs to client requests.

## Models, types, and UI

- Use `src/models/` for API contracts and domain data that benefits from a named model. Keep code-only shapes in `src/types/` and single-use types near their consumer.
- Use the existing shadcn/ui components in `src/components/ui/` and Tailwind CSS for styling. Do not add another component library or a separate CSS framework.
- Keep API calls out of presentation components when a resource hook already owns that query.
- Use toast or inline feedback for failures that need the user's attention. Confirm destructive actions and prevent accidental navigation away from unsaved work.

## Tests and commands

- Add or update focused Vitest tests when frontend behavior changes. Keep test data close to the behavior and assert user-visible outcomes or request contracts.
- Run the documented checks when asked to test or verify a change. The client scripts are `npm run build`, `npm run lint`, and `npm test`.
