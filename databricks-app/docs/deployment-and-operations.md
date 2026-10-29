# Deployment and operations

## Existing sandbox installation

The maintained sandbox installation is Databricks App `vdab-builder-sandbox`. Its default source is the single folder:

`/Workspace/Users/patrick.wayne.marshall@gmail.com/.vdab/builder/vdab-builder-sandbox`

Build the release package from the repository, then synchronize its contents to this same folder and deploy the existing App:

```powershell
cd databricks-app
npm run build
npm run smoke
cd ..
databricks sync .\databricks-app\.build /Workspace/Users/<your-email>/.vdab/builder/vdab-builder-sandbox --profile <profile>
databricks apps deploy vdab-builder-sandbox --source-code-path /Workspace/Users/<your-email>/.vdab/builder/vdab-builder-sandbox --mode SNAPSHOT --profile <profile>
databricks apps get vdab-builder-sandbox --profile <profile>
```

Use the same profile, App name, and source folder on every update. Do not make a new dated folder for each build. Databricks keeps deployment snapshots under its managed App deployment area; the user-owned `.vdab/builder/` directory should contain only the current package source. Never delete the `postgres` Lakebase resource, customer database, child Apps, or their data as part of a builder source update.

The current sandbox workspace verified this flow on 2026-10-29: the package deployed from the path above, the App reached deployment `SUCCEEDED`, `app_status=RUNNING`, and `default_source_code_path` matched that path. See CLI output in the active task history; it is not a substitute for subsequent health checks.

## First install

Create the Databricks App and bind the customer-owned Lakebase Autoscaling resource before deploying. Configure only approved user API scopes and explicit resource bindings in the workspace. VDAB does not create the Lakebase project/database, SQL warehouse, child Apps, model endpoints, Jobs, or Unity Catalog assets. Use the installed workspace's provisioning and permission workflows, then deploy `.build/` and check app status, logs, migration completion, consent, and a representative project save/reopen.

## Health and troubleshooting

- **Deployment fails or App is unavailable:** inspect the active deployment status and App logs. Confirm `app.yaml`, Node command, package lockfile, `DATABRICKS_APP_PORT` binding, and resource configuration.
- **Lakebase is unavailable:** check the `postgres` App resource and its `Can connect and create` permission. Confirm migrations report success. Do not expose injected values or credentials in logs.
- **A workspace picker is empty or denied:** verify acting-user permission and OAuth consent for that resource/API. A denial must not retry as App identity.
- **Generated App deploy fails:** check caller permission, target-space/resource match, child App's source-folder access, deployment status, and immutable snapshot. Verify the target before retry or rollback.
- **Rollback:** restore the previously built `.build/` package into the same source folder and deploy again, or use the product's project deployment recovery flow for child Apps. Keep Lakebase backups as the data-recovery mechanism; a source deployment snapshot does not roll back database state.

## Data recovery and uninstall

Project export is for portability. Lakebase backup/PITR is for installation-state recovery. Preserve database snapshots and deployment records according to the data owner's retention policy. Removing the builder App does not automatically remove its bound Lakebase data, child Apps, or generated source folders; handle each resource separately after confirming backup and ownership.
