# VDAB React client

This directory contains the React source used by the standalone Databricks App. It is not deployed as an independent SaaS frontend. The supported standalone production build is orchestrated from `databricks-app/`; that command sets `VITE_VDAB_RUNTIME=databricks`, builds the client, and packages its assets into `databricks-app/.build/public/`.

The standalone route set contains the project list/editor, installed-workspace Apps list, and workspace setup. The UI calls the same-origin Node API under `/api/v1`. Server data uses TanStack Query; browser code does not store Databricks OAuth tokens or choose a workspace host.

## Build and run the standalone app

From the repository root:

```powershell
cd databricks-app
npm run install:all
npm run build
npm run smoke
$env:NODE_ENV = "development"
$env:VDAB_AUTH_MODE = "local-test"
$env:VDAB_LOCAL_USER_ID = "local-editor"
npm run start:packaged
```

The packaged local-test adapter serves the app on `http://localhost:8000/` and uses in-memory state. It makes no Databricks requests and is not a deployed authentication mode. Do not run the client Vite build directly as a substitute for the standalone packaging command.

## Client checks

Install the client dependencies with `npm run install:client` from `databricks-app/`, then run from this directory:

```powershell
cd ../xorbix-visual-databricks-app-builder.client
npm test -- --run --maxWorkers=4
npm run lint:standalone
node node_modules/typescript/bin/tsc --noEmit
```

The general `npm run lint` command also scans retained SaaS-reference pages and generated React Router types. For the active standalone slice, use `lint:standalone`.

## Runtime and security

- The Databricks build replaces legacy Application Insights telemetry with a no-op adapter. The packaged asset smoke test rejects those telemetry fingerprints.
- API requests are same-origin; the Node backend derives the installed workspace from trusted App runtime configuration.
- User-triggered workspace operations require the forwarded caller authorization and fail closed on denial.
- Keep workspace hosts, user tokens, App secrets, and Lakebase credentials out of client code and browser storage.
- No new dependency is permitted without the security, license, maintenance, scope, and deployment-impact review and explicit approval in [AGENTS.md](../AGENTS.md).

Workspace setup and deployment are documented in [databricks-app/DEPLOYMENT.md](../databricks-app/DEPLOYMENT.md). Databricks scopes, Marketplace installation, and generated Streamlit execution require the manual checks in [the transition checklist](../.documentation/databricks-app-transition/manual-workspace-testing.md).
