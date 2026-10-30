# VDAB Databricks App

VDAB is a standalone Databricks App for designing, previewing, and deploying Python/Streamlit applications in the workspace where VDAB is installed. The builder uses a Node.js backend, a React UI, and customer-owned Lakebase Autoscaling for durable project state. It does not connect to SaaS tenants or migrate SaaS accounts/projects.

## Build and run locally

Requirements: Node.js 22.16 or later and npm.

```powershell
cd databricks-app
npm run install:all
npm run build
npm run smoke
$env:VDAB_AUTH_MODE = "local-test"
$env:VDAB_LOCAL_USER_ID = "local-editor"
$env:NODE_ENV = "development"
npm run start:packaged
```

Open `http://localhost:8000/`. Local test identity is development-only and never calls Databricks. `npm run build` typechecks and tests the server, builds the client, and creates the deployment package at `.build/`. `npm run smoke` checks the assembled package and local-only request flows.

## Deploy and update

For a new installation, follow the [complete installation and verification guide](docs/installation.md). It includes the PostgreSQL schema grants and per-user OAuth consent checks required in addition to App resource bindings and configured scopes.

The sandbox builder uses the same app and source folder for every update:

- Databricks App: `vdab-builder-sandbox`
- Workspace source: `/Workspace/Users/<your-email>/.vdab/builder/vdab-builder-sandbox`
- Local package: `databricks-app/.build/`

Build first, upload the contents of `.build/` to the same workspace source folder, and deploy the existing App with `--mode SNAPSHOT`. See [deployment and operations](docs/deployment-and-operations.md) for the exact commands and recovery steps. Do not deploy the repository root or create a dated source folder for routine updates.

## Product documentation

Start at [VDAB documentation](docs/README.md). It covers the product, architecture, browser UI, server, API, persistence, generated applications, security, operations, and development workflow.

## Package contents

`.build/` is self-contained and contains the production Node manifest/lockfile, `app.yaml`, server source, and compiled client assets. It excludes source tests, local configuration, SaaS/.NET source, and secrets. The repository-root `package.json` is tooling metadata; it is not the Databricks App manifest.
