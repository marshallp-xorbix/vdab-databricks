# Xorbix Visual Databricks App Builder (VDAB)

VDAB is a standalone Databricks App for visually building and deploying Python/Streamlit apps in the workspace where VDAB is installed. Each install starts with its own customer-owned Lakebase state; it does not connect to the former SaaS product or import SaaS users or projects.

## Architecture

- Builder backend: strict TypeScript/Node.js Databricks App.
- Builder UI: React 19, React Router v7, shadcn/ui, and Tailwind CSS.
- Durable builder state: customer-owned Lakebase Autoscaling PostgreSQL bound to the installed App.
- Generated child apps: Python and Streamlit.
- Workspace operations: same-workspace Databricks APIs, caller-authorized for user actions.
- Release directory: `databricks-app/.build/`; do not deploy the repository root.

The legacy .NET/Aspire/Azure source is still present as a temporary parity reference while the transition gates remain open. It is not the standalone product runtime or deployment package. Use the active Node instructions below rather than legacy SaaS setup guides.

## Local build and run

Requirements: Node.js 22.16 or later and npm.

From PowerShell at the repository root:

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

Open `http://localhost:8000/`. The local-test adapter is in-memory and does not contact Databricks; it loses its data on restart and must never be enabled for a deployed App.

The build typechecks the server, runs Node tests, builds the frontend with the standalone Databricks runtime, and assembles a production-only package. The smoke command exercises the packaged app and checks that SaaS Application Insights code is absent. For the detailed build, resource, backup, install, update, and recovery instructions, see [databricks-app/README.md](./databricks-app/README.md) and [databricks-app/DEPLOYMENT.md](./databricks-app/DEPLOYMENT.md).

## Test commands

Run the Node package suite and build from `databricks-app/`:

```powershell
npm run typecheck
npm test
npm run build
npm run smoke
```

Run the full React client regression and the standalone-source checks from `xorbix-visual-databricks-app-builder.client/` after installing its dependencies:

```powershell
npm test -- --run --maxWorkers=4
npm run lint:standalone
node node_modules/typescript/bin/tsc --noEmit
```

A real PostgreSQL migration check can be run with `npm run test:postgres` from `databricks-app/` when PostgreSQL 17 tools are installed. It creates and removes a temporary local cluster bound to loopback. The optional integration test skips unless `VDAB_TEST_DATABASE_URL` is set.

## Databricks installation

Workspace installation, user scopes, Lakebase resource binding, deployment, and the manual security/parity procedure are documented in [databricks-app/DEPLOYMENT.md](./databricks-app/DEPLOYMENT.md) and [.documentation/databricks-app-transition/manual-workspace-testing.md](./.documentation/databricks-app-transition/manual-workspace-testing.md). The current owner instruction is not to connect to Databricks, so G2/G3/G4/G5, Marketplace installation, and workspace runtime behavior remain explicitly unverified. A passing local package build is not evidence of workspace or Marketplace approval.

## Transition references

- [Ordered transition plan](./.documentation/databricks-app-transition/README.md)
- [Feature parity matrix](./.documentation/databricks-app-transition/feature-parity-matrix.md)
- [Decisions and gates](./.documentation/databricks-app-transition/00-decisions-and-gates.md)
- [Current source inventory](./.documentation/databricks-app-transition/source-inventory.md)
- [Node Databricks App architecture](./.documentation/standards/node-databricks-app-architecture.md)
- [ADR 0002 — Node Databricks App](./.documentation/adr/0002-vdab-node-databricks-app.md)
- [Durable progress and handoff](./.documentation/databricks-app-transition/progress-and-handoff.md)