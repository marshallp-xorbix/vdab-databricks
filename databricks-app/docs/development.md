# Local development and verification

## Prerequisites

- Node.js 22.16 or later and npm.
- Repository dependencies from the committed root/client/server lockfiles.
- PostgreSQL only for tests explicitly marked as integration tests; ordinary local startup uses a clearly labeled test identity and workspace adapter.

## Install, build, smoke

From `databricks-app/`:

```powershell
npm run install:all
npm run build
npm run smoke
```

The build typechecks the server, runs its Node contract/service/adapter/generator tests, builds the React client in standalone mode, and assembles `.build/`. The smoke suite exercises packaged assets, HTTP behavior, and representative preview/setup diagnostics through local test adapters. It does not prove Databricks scopes, live Lakebase, or child-App execution.

For local packaged startup:

```powershell
$env:VDAB_AUTH_MODE = "local-test"
$env:VDAB_LOCAL_USER_ID = "local-editor"
$env:NODE_ENV = "development"
npm run start:packaged
```

The local adapter is not production identity and does not contact Databricks. Keep `NODE_ENV=production` for deployment; local-test identity must fail closed there.

## Making a change

Keep responsibilities at their architecture boundary. For API behavior, update server validation/contracts, service/repository or adapter code, browser API/hook integration, and focused tests together. For generated output, add/adjust a fixture or executable case for the affected component/action. For schema changes, add a new migration and migration test; do not modify an applied migration.

Do not add a package without the explicit dependency approval required by `AGENTS.md`. Do not add secrets or customer workspace configuration to the repository.

## Repository test boundaries

Server tests are under `databricks-app/server/test/`; client tests live by the API, hook, component, or page they cover. Database integration tests use disposable PostgreSQL when configured and may report a clear skip when it is unavailable. Live workspace checks are recorded separately from local test results.
