# Deployment and operations

## Existing workspace-source installation

Build the release package from the repository, then synchronize its contents to the same workspace source folder and redeploy the existing App:

```sh
cd databricks-app
npm run build
npm run smoke
cd ..

APP_NAME="your-vdab-app"
WORKSPACE_USER="you@example.com"
PROFILE="your-databricks-profile"
WORKSPACE_SOURCE="/Workspace/Users/${WORKSPACE_USER}/.vdab/builder/${APP_NAME}"

databricks sync databricks-app/.build "$WORKSPACE_SOURCE" --profile "$PROFILE" --full \
  --include 'app.yaml' --include 'package*.json' --include '*.md' \
  --include 'public/**' --include 'server/**'
databricks apps deploy "$APP_NAME" --source-code-path "$WORKSPACE_SOURCE" --mode SNAPSHOT --profile "$PROFILE"
databricks apps get "$APP_NAME" --profile "$PROFILE"
```

The explicit include patterns are required because `.build/` is Git-ignored; otherwise the CLI can report a successful sync while skipping the package. Check the sync output for uploaded package files before deploying.

Use the same profile, App name, and source folder on every update. Do not make a new dated folder for each build. Databricks keeps deployment snapshots under its managed App deployment area; the workspace source folder should contain only the current package source. Never delete the `postgres` Lakebase resource, customer database, child Apps, or their data as part of a builder source update. See the [Databricks deployment guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy) for additional deployment options.

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
