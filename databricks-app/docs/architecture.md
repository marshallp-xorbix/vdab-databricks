# Architecture

## Runtime

```text
React browser app
        │ same-origin /api/v1
        ▼
Node HTTP boundary → application services → repositories → Lakebase PostgreSQL
                         ├→ Databricks workspace adapters
                         ├→ configured AI endpoints
                         └→ Streamlit source generator and child-App deployment
```

The builder is a Node.js Databricks App. Its React client is built into static files served by the Node process. Generated child apps are Python/Streamlit applications and have their own App identity, permissions, resources, and lifecycle.

## Responsibilities

- `server/src/http-app.ts`, route modules, and request validators own HTTP parsing, trusted identity context, boundary validation, and response mapping.
- Services orchestrate project, workspace, AI, preview, and deployment behavior. They do not construct SQL or depend on request objects.
- Repositories own parameterized PostgreSQL operations and transactions.
- Workspace adapters call Databricks APIs with the installed workspace host and the acting user's forwarded authorization for user-triggered actions.
- `component-registry/` defines available component types and binding schemas.
- `generation/` renders deterministic preview and deployable Python/Streamlit output.
- The React client owns presentation and client/UI state. TanStack Query owns fetched server state.

Keep each dependency moving toward the persistence or integration boundary. A handler must not access SQL; a service must not access a database driver; a generated app must not inherit the builder's credentials.

## Composition and runtime configuration

`server/src/main.ts` is the composition root. Production startup uses Databricks App runtime identity/configuration and the `postgres` App resource. The process binds to `DATABRICKS_APP_PORT` when present. Local development uses the explicit `VDAB_AUTH_MODE=local-test` adapter and cannot run with production mode.

## Package boundary

`npm run build` assembles `.build/`, the only deployment source. It contains the runtime manifest and lockfile, `app.yaml`, server source, and compiled browser assets. It excludes repository tests, legacy source, local settings, and secrets. Generated child-App source is produced from project state at deployment time and is not the builder package.
