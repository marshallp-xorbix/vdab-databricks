# Deployment

The maintained install and update commands, stable workspace source folder, health checks, recovery, and Lakebase operations are documented in [deployment and operations](docs/deployment-and-operations.md).

Deploy only the contents of `databricks-app/.build/`. For the sandbox install, reuse Databricks App `vdab-builder-sandbox` and source folder `/Workspace/Users/<your-email>/.vdab/builder/vdab-builder-sandbox` on each update. Do not create per-build workspace folders.
