# 3. Node.js Databricks App foundation

**Depends on:** G1/G2, approved architecture standards, and approval for any new npm dependencies.  
**Output:** A deployable TypeScript/Node.js builder shell with one vertical slice.

## Proposed layout

Use `databricks-app/` as the Node App source/development package and generate a self-contained deployment directory at `databricks-app/.build/`. The generated directory has its own production `package.json`/lockfile, `app.yaml`, Node server sources, and built React assets; it excludes the legacy .NET/SaaS repository. Keep the production-only runtime manifest and lockfile under `databricks-app/runtime/` in source control, and copy them unchanged during packaging so release generation never re-resolves the dependency graph. Keep TypeScript strict. Separate HTTP boundary, application services, repositories, shared contracts, Databricks integrations, and generator modules. Deploy only the generated directory.

## Work

1. Revise AGENTS, the canonical architecture material, repository layout, and local commands for the approved Node target while preserving current .NET instructions for code that remains during migration. Add an ADR explaining the runtime and one-workspace deployment decision.
2. Select the minimum server, validation, PostgreSQL, Databricks API, logging, and test dependencies. Record the required security/license/maintenance/scope/deployment evaluation and get explicit approval before installing. Do not assume the Beta JavaScript SDK is required; a small typed HTTP client may be appropriate if it reduces dependency and version risk.
3. Create a single-process server that serves React assets and `/api` routes, binds the injected port on `0.0.0.0`, has a liveness endpoint, graceful shutdown, structured redacted logs, correlation IDs, request body limits, boundary validation, and consistent typed error-to-HTTP mapping.
4. Define contract schemas and generated or shared types without importing server-only secrets into browser code. Keep API calls in client `src/api/` and server state in TanStack Query hooks.
5. Build local development with mocked Databricks identity and disposable local database, using explicit configuration. Production must fail closed if native identity or required resource bindings are missing.
6. Port one complete read-only vertical slice (for example list apps) through HTTP → service → repository, with an authorization check and frontend query. Use it to validate structure and test strategy.
7. Build and package only the Databricks deploy root. Add CI checks for typecheck, lint, tests, client build, package validation, and a smoke deploy to a development workspace.

## Tests

- Unit tests for validation, error mapping, identity boundary, and configuration failure.
- Contract test for the selected vertical slice and existing client response shape.
- Run a packaged app locally and in Databricks; verify static assets, `/api`, port binding, restart, logs, and no secrets in built assets.

## Exit criteria

- One verified Databricks App deployment starts without Azure/Aspire/.NET at runtime.
- The vertical slice works in a development workspace under native user authentication.
- CI can reproduce the package from a clean checkout, and all new dependencies have approval records.
