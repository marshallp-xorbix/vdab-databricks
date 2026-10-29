# Browser application

The browser UI is React 19 with React Router v7 Framework Mode, shadcn/ui, and Tailwind CSS. It is built from `xorbix-visual-databricks-app-builder.client/` and served by the Node App from the same origin as its API.

## Application areas

- The standalone shell and navigation provide project, workspace, settings, and setup surfaces.
- Project management lists and creates projects visible to the signed-in user.
- The project editor loads project metadata, component tree, workflows, modules, and workspace references, then supports canvas editing, properties, preview, import/export, and deployment actions.
- Workspace pages discover current-workspace Apps and Databricks resources through server APIs.
- AI Builder uses a customer-configured workspace endpoint and returns structured project changes through the server contract.

## State and API use

Use TanStack Query hooks for server state. API modules contain raw HTTP calls; query and mutation hooks own query keys, cache invalidation, pending state, and error handling. Local interaction state belongs in React state or context. Do not mirror API entities in ad hoc effects or add a second client-state store.

The frontend sends same-origin versioned requests under `/api/v1`. Runtime schemas and server validation remain authoritative; client models and TypeScript types do not validate untrusted requests.

## Interaction requirements

Pages provide loading, empty, error, and permission-denied states. Destructive project or component actions require clear confirmation. Forms expose validation and errors, keyboard focus remains usable in dialogs and sheets, and layout adapts to narrow viewports. Preserve the existing standalone visual language and shadcn/Tailwind conventions when modifying the UI.

Detailed client conventions live in the repository's required [frontend patterns](../../.documentation/standards/frontend-patterns.md) and [AGENTS.md](../../AGENTS.md).
