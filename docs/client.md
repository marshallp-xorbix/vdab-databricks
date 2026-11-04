# React Client

This directory contains the React client bundled into the VDAB Databricks App. It is built as part of the deployment package from `src/databricks-app/` and is served by the Node process at `src/databricks-app/.build/`.

The installed client includes the project list and editor, workspace App controls, and workspace setup. It calls the same-origin Node API under `/api/v1`. TanStack Query owns fetched server state; browser code does not store Databricks tokens or select a workspace host.

## Build and run

Use the repository [README](install.md) for installation and deployment instructions. From the repository root:

```powershell
cd src/databricks-app
npm run install:all
npm run build
npm run smoke
$env:NODE_ENV = "development"
$env:VDAB_AUTH_MODE = "local-test"
$env:VDAB_LOCAL_USER_ID = "local-editor"
npm run start:packaged
```

The local-test adapter serves `http://localhost:8000/` with in-memory state and makes no Databricks requests. Build through `src/databricks-app/` so the client assets and Node server are packaged together.

## Client development

After dependencies are installed through `databricks-app`, run client checks from this directory:

```powershell
npm test -- --run --maxWorkers=4
npm run lint
node node_modules/typescript/bin/tsc --noEmit
```

## Runtime and security

- API requests are same-origin; the Node backend derives the installed workspace from trusted App runtime configuration.
- User-triggered workspace operations use the caller's forwarded authorization and fail closed on denial.
- Keep workspace hosts, user tokens, App secrets, and Lakebase credentials out of client code and browser storage.
- Do not add dependencies without the review and approval process in [AGENTS.md](../AGENTS.md).

Product setup and deployment are documented in [the documentation index](README.md). The [API reference](api-reference.md) documents the browser contract.
