# Deployment

Start with the repository [README](../readme.md) for machine prerequisites, workspace and Lakebase setup, schema grants, App scopes, per-user OAuth consent, Unix-style commands, and builder usage. Windows users can run its commands in Git Bash or WSL.

Use [deployment and operations](docs/deployment-and-operations.md) for routine source updates, recovery, backups, and uninstall.

Deploy only the contents of `databricks-app/.build/` to the chosen stable workspace source folder. Reuse the same App and source folder for updates; preserve its Lakebase binding. Do not deploy the repository root or a new dated source folder for each update.
