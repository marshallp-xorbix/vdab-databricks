# Deployment

Start with the [complete installation and verification guide](docs/installation.md). It includes machine prerequisites, workspace and Lakebase setup, schema grants, approved user scopes, per-user OAuth consent, exact deployment commands, and acceptance checks. It includes values for the company workspace and generic values for other installations.

Use [deployment and operations](docs/deployment-and-operations.md) for routine source updates, recovery, backups, and uninstall.

Deploy only the contents of `databricks-app/.build/` to the chosen stable workspace source folder. Reuse the same App and source folder for updates; preserve its Lakebase binding. Do not deploy the repository root or a new dated source folder for each update.
