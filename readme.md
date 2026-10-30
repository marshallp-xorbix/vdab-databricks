# Xorbix Visual Databricks App Builder

VDAB is a standalone Databricks App for designing, previewing, and deploying Python/Streamlit apps in the workspace where it is installed. The active product is a TypeScript/Node.js backend, React 19 frontend, customer-owned Lakebase Autoscaling database, and Streamlit child-app generator.

## Build locally

Requirements: Node.js 22.16 or later and npm.

```powershell
cd databricks-app
npm run install:all
npm run build
npm run smoke
```

For development-only packaged startup, set `VDAB_AUTH_MODE=local-test`, `VDAB_LOCAL_USER_ID=local-editor`, and `NODE_ENV=development`, then run `npm run start:packaged` from `databricks-app/`. This adapter is isolated from Databricks and is not suitable for a deployed App.

## Documentation

- [Complete installation and verification guide](databricks-app/docs/installation.md) — machine setup, database grants, scopes, per-user consent, and deployment
- [Product and engineering documentation](databricks-app/docs/README.md)
- [Deployment and operations](databricks-app/docs/deployment-and-operations.md)
- [Repository rules](AGENTS.md)

## Deployment boundary

The only builder deployment source is `databricks-app/.build/`. The current sandbox App uses `/Workspace/Users/<your-email>/.vdab/builder/vdab-builder-sandbox`; updates reuse this same folder and App. Legacy SaaS/.NET files are not included in the release package or active product runtime.
