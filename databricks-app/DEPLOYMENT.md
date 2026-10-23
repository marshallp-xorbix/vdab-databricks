# VDAB workspace install and update

This runbook separates reproducible local package preparation from Databricks workspace actions. The CLI sequence below follows current Databricks workspace-source deployment documentation; it has **not** been executed for VDAB. The owner instructed us not to connect to Databricks, so every workspace action below remains a manual step.

## Local package preparation (verified)

Requirements: Node.js 22.16 or later, npm, and this repository checkout.

From PowerShell:

```powershell
cd databricks-app
npm run install:all
npm run build
npm run smoke
```

`npm run build` typechecks the Node server, runs its tests, builds the React client, and assembles `.build/`. `npm run smoke` launches the assembled package through local adapters and checks the HTTP routes and generated preview flows. This validates packaging and local behavior only.

If generated projects will use Unity Catalog components, Unity Catalog SaveToTable targets, or BuildSql actions without their own warehouse selection, add the optional builder resource mapping during packaging:

```powershell
$env:VDAB_DEFAULT_SQL_WAREHOUSE_RESOURCE_KEY = "vdab-default-sql-warehouse"
npm run build
Remove-Item Env:VDAB_DEFAULT_SQL_WAREHOUSE_RESOURCE_KEY
```

During workspace app setup, add an existing SQL warehouse as a builder App resource with the same custom key and `Can use` permission. The packaging option writes a `DATABRICKS_SQL_WAREHOUSE_ID` `valueFrom` entry in `.build/app.yaml`; Databricks resolves the selected resource to the workspace-local warehouse ID. Use the same build option for each package update that should retain this default. Leave it unset and omit the warehouse resource if no generated project needs a default. This does not make generated queries use the builder service principal: they continue to use each viewer's forwarded token. The SQL warehouse is neither created nor changed by VDAB. See [Databricks Apps environment variables](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/environment-variables) and [SQL warehouse resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/sql-warehouse).

The release directory is `databricks-app/.build/`. It contains the production Node manifest and lockfile, `app.yaml`, server TypeScript source, compiled client assets under `public/`, `DEPENDENCY_LICENSE_INVENTORY.md`, and `THIRD_PARTY_NOTICES.md`. The inventory is generated from the Node and client lockfiles and includes the approved conditional `asyncpg` child-app dependency. The notices file copies package-supplied license/notice text found in installed packages, includes the pinned asyncpg 0.32.0 Apache-2.0 text, and marks missing, uninstalled, or oversized documents for review. Each Lakebase-backed generated child source bundle also contains that license at `THIRD_PARTY_NOTICES/asyncpg-0.32.0-LICENSE.txt`. These files are evidence for review, not legal approval or an SPDX SBOM; confirm notice completeness and required Marketplace materials before publication. Deploy only `.build`; the repository root contains legacy SaaS/.NET source and is not the Databricks App package.

To start the packaged app locally for a local-only check:

```powershell
$env:NODE_ENV = "development"
$env:VDAB_AUTH_MODE = "local-test"
$env:VDAB_LOCAL_USER_ID = "local-editor"
npm run start:packaged
```

The `local-test` adapter is in-memory, loses data on restart, and must not be enabled for a deployed App.

## Workspace prerequisites

Use a workspace where you are authorized to create or manage Apps and where a customer-owned Lakebase Autoscaling project, branch, and database are available. Add the database to the App as a resource with the key `postgres` and `Can connect and create` permission. Databricks currently injects `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGSSLMODE`; `app.yaml` maps `LAKEBASE_ENDPOINT` from the `postgres` resource. The App exchanges short-lived OAuth credentials for a short-lived Lakebase password. No static database password belongs in this repository. See [Databricks Lakebase App resource documentation](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase).

The optional installed-workspace default SQL warehouse uses an App resource, not a hardcoded ID. Set `VDAB_DEFAULT_SQL_WAREHOUSE_RESOURCE_KEY` while packaging, then add an existing SQL warehouse to the builder App in the Databricks Apps UI using that exact custom key and `Can use` permission. Databricks resolves the `valueFrom` environment mapping to `DATABRICKS_SQL_WAREHOUSE_ID`. Use this only when generated projects need a default for Unity Catalog components, Unity Catalog SaveToTable targets, or BuildSql actions without their own selected warehouse. VDAB does not create or select a warehouse for the customer. Deployment readiness blocks those generated-app features if the value is absent or malformed. For create-new child Apps, VDAB derives a deterministic `sql_warehouse` resource with `CAN_USE` and generates an `app.yaml` `valueFrom` mapping. Link-existing requires the exact expected SQL warehouse and Lakebase resource set. Queries continue to use each viewer's forwarded token; the resource binding does not authorize a service-principal fallback. Resource acceptance, environment injection, grants, and generated SQL behavior are unverified until the [manual workspace test](../.documentation/databricks-app-transition/manual-workspace-testing.md#child-app-sql-warehouse-binding) is performed.

Set `VDAB_INSTALL_ADMIN_IDS` in the App's environment configuration to a comma-separated list of Databricks user IDs authorized for the installation recovery role. This is an explicit install-maintained list; it does not infer workspace-admin rights.

Configure user-authorization scopes in the Databricks Apps UI or the `user_api_scopes` CLI property, and require each user to consent. The current Apps guide lists API scopes such as `apps`, `files`, `genie`, `model-serving`, `postgres`, `sql`, `vector-search`, `ai-functions`, and `ai-gateway`. It also lists SDK scopes `catalog.catalogs`, `catalog.connections`, `catalog.schemas`, `catalog.tables`, and `workspace.workspace`; each SDK scope supports a `:read` modifier. The App Spaces Data + AI preset additionally documents `mcp.external` and `mcp.functions`. The deployment adapter accepts those documented scope values, but that validation does not prove a given scope authorizes a raw REST call.

VDAB uses direct Unity Catalog REST calls for catalog, schema, table, summary, and Volume discovery. The corresponding API reference labels the UC list operations with the `unity-catalog` scope, which the Apps supported-scope list does not expose. Test `catalog.catalogs:read` for catalog listing, `catalog.schemas:read` for schema listing, and `catalog.tables:read` for table listing/details/summaries as candidate Apps scopes; they are documented SDK scopes, and their mapping to VDAB's raw REST requests is unverified. Use only the forwarded user token and do not switch to App identity after denial. Volume metadata listing has no matching granular `catalog.volumes` Apps scope in the current guide. The `files` scope used for generated FileUpload covers a different Files API operation and does not establish Volume-list access.

The current Apps scope list also omits `jobs`, `scim`, and `identity`; Jobs and workspace-directory actions therefore remain fail-closed. The Apps guide recommends model-serving for endpoint authorization, but the direct discovery/inference calls still require the documented manual workspace test. Do not invent a scope or retry a denied user action using the App service principal. See [Databricks Apps authorization and supported scopes](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth), [App Spaces scopes](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces), [Workspace API scopes](https://docs.databricks.com/api/workspace/scopes), [Unity Catalog tables API](https://docs.databricks.com/api/uc-tables/v1/list-tables), [Workspace Import API](https://docs.databricks.com/api/workspace-objects/v1/import), and the [manual workspace checklist](../.documentation/databricks-app-transition/manual-workspace-testing.md).

The Workspace setup page's **Check workspace setup** action reads only the presence of Lakebase environment fields and, with the current user's forwarded token, makes read-only calls to the installed workspace's Get App and current-user OAuth consent endpoints. It does not return resource values or credentials, use App identity as a fallback, or claim Lakebase grants/connectivity are healthy. A successful scope/consent response is still not proof of access to each resource; exercise each feature with authorized and denied users. The check requires an App name and the caller's ability to read the App/consent metadata. If it reports unavailable, inspect the configured App scopes and OAuth consent in Databricks, then test the affected feature. This path is covered by offline fakes only until the owner runs the manual workspace checklist. Databricks documents `DATABRICKS_APP_NAME` and `DATABRICKS_HOST` as default App environment variables, the Lakebase variables used by the binding check, the Apps scope for Get App, and the current-user consent operation; see the [Apps environment reference](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env), [Lakebase App resource guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase), [Apps API](https://docs.databricks.com/api/apps/v1/app), and [OAuth consent guide](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m#manage-your-oauth-consent).

For child-App creation, the Apps API documents the `apps` scope for create/deployment operations. Databricks injects `DATABRICKS_APP_NAME`; with the current user's forwarded token, VDAB reads the installed builder App's `space` and creates child Apps in that same space. An explicit null/empty `space` means unspaced, and create-new omits `space`; a missing `space` property is treated as unknown and fails closed before child-App mutation. Link-existing requires the selected App to match that same space (including no-space). When Databricks returns `effective_user_api_scopes`, VDAB checks those scopes for space-bound Apps and blocks if the effective list is unavailable. A workspace admin controls App Space roles/scopes and can grant `CAN CREATE APP`; ensure the space allows the required operations and generated-app scopes. The first-party CLI documents `--space`, and the generated Databricks Go SDK App model exposes the same field, while the REST API reference currently omits it; this path still requires manual workspace verification. The client creates the App with `no_compute=true`, uses caller-authorized immutable source uploads and `SNAPSHOT` deployments, checks the documented 100-App workspace limit before create, and does not grant source-folder permissions on behalf of the user. Grant the child App service principal read access to its generated source folder through the supported workspace permission workflow. Workspace Import is limited to 10 MB per file. The `workspace.workspace` Apps SDK scope versus the Workspace REST API's `workspace` scope, child service-principal folder access, App Space scope policy, and any Git-only workspace policy must be verified before treating child-App lifecycle as workspace ready. See [App Spaces](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-spaces), [Apps CLI commands](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands), the [Databricks Go SDK App model](https://github.com/databricks/databricks-sdk-go/blob/main/service/apps/model.go), the [Apps API](https://docs.databricks.com/api/apps/v1/app), and the [Workspace Import API](https://docs.databricks.com/api/workspace-objects/v1/import).

### Generated child-App Lakebase resources

The child-App generator derives one deterministic resource key for each selected Autoscaling or existing Provisioned database, and writes a separate `valueFrom` environment variable for each key. Autoscaling variables resolve to endpoint paths and the generated runtime retrieves the corresponding host through the viewer-authorized Postgres Endpoint API. Provisioned variables resolve to the selected host, which the generated runtime checks against instance metadata. Create-new includes the full existing-resource set in the Apps create request. Link-existing requires an exact match with resources already attached to the selected App; missing, extra, or differently bound resources block source upload and deployment. This behavior has offline adapter, manifest, service, fake-runtime, and regression coverage only. Perform the multi-resource and per-viewer checks in the [manual workspace test plan](../.documentation/databricks-app-transition/manual-workspace-testing.md#child-app-lakebase-resource-bindings) before treating child-App Lakebase execution as workspace verified.

Databricks lists a fixed limit of 100 Apps per workspace. VDAB blocks create-new when the caller-authorized Apps list reaches that count and surfaces API `429 RESOURCE_EXHAUSTED` responses without retrying writes. Counts can race with other users, so Databricks remains authoritative. Apps compute is billed while running; configure and review workspace usage policies and compute before customer deployment. See [Databricks resource limits](https://docs.databricks.com/aws/en/resources/limits) and [Databricks Apps overview](https://docs.databricks.com/aws/en/dev-tools/databricks-apps).

The presence of an `apps` scope does not prove that an installed VDAB Marketplace instance may create another App. Child-App create-new, link-existing, deployment, consent, and permission flows remain a separate feasibility spike. Do not claim those live flows until they are exercised in an authorized disposable workspace.

## First install (workspace procedure; unverified for VDAB)

1. Authenticate the Databricks CLI to the intended development workspace and confirm the active profile and host locally. Do not paste tokens or credential output into logs or this repository.
2. Build and smoke-test `.build/` as above.
3. Create a custom Databricks App named `vdab-builder` in the workspace UI, or with `databricks apps create vdab-builder --no-compute`. Configure approved user scopes and bind the `postgres` Lakebase Autoscaling resource before deployment. If `.build/app.yaml` contains `DATABRICKS_SQL_WAREHOUSE_ID`, also add an existing SQL warehouse resource to the builder App using the custom resource key selected at build time and `Can use` permission. The local package does not provision a Lakebase project, database, or warehouse.
4. From the repository root, upload the built package and deploy it from its workspace path:

   ```powershell
   databricks sync .\databricks-app\.build /Workspace/Users/<your-email>/vdab-builder-source
   databricks apps deploy vdab-builder --source-code-path /Workspace/Users/<your-email>/vdab-builder-source --mode SNAPSHOT
   ```

   Workspace-folder deployment follows [Deploy a Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy?language=Databricks+CLI) and the [`apps` CLI command reference](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands). These commands document the current CLI shape; they have not been run for VDAB.

5. Inspect deployment status and App logs in the Databricks Apps UI. Confirm the App starts with `VDAB_AUTH_MODE=databricks`, migrations complete, and expected resource/environment variables are present without exposing their values. First use should exercise sign-in and configured user consent.

Workspace CLI versions, permissions, network policy, resource binding, and installation behavior still need validation in the target workspace.

## Update and rollback

For an update, rerun local install/build/smoke, sync the new `.build/` contents to the same workspace source path, and deploy the existing App from that path with `--mode SNAPSHOT`. Databricks updates the App deployment without recreating the App. Keep each tested `.build/` artifact or source revision available for recovery; workspace-source rollback requires restoring the previous package contents and deploying again. Check deployment history and logs after each update. See [Update or redeploy a Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy?language=Databricks+CLI#update-or-redeploy-the-app).

## Backup, recovery, and uninstall

Use two separate recovery artifacts: a VDAB project export for moving a design and a Lakebase backup for restoring installation state. The versioned project export contains project metadata, theme, components, workflows, custom-module source, display-only resource references, and a child-App reselection marker. It deliberately omits workspace IDs, credentials, and current resource bindings. It is **not** a Lakebase backup and does not contain deployment history or the private child-App source snapshots used by retry and rollback. Keep a database backup when those records are needed.

### Lakebase backup and recovery

1. Set the root branch's Lakebase history window to match the installation's recovery policy. Lakebase Autoscaling defaults to seven days and supports a two-to-thirty-day history window. Point-in-time restore creates a new branch; it does not rewind the existing branch.
2. Configure a scheduled snapshot for the root branch, with cadence and retention approved by the data owner. Current Lakebase snapshot schedules support daily, weekly, or monthly cadences and retention from one hour through 35 days. Snapshot storage is billable. Create a manual snapshot before a VDAB schema migration or a destructive maintenance operation; manual snapshots are limited to ten per project.
3. At a recovery drill, restore a snapshot or point in time to a new branch. Validate the restored schema and representative project/deployment records with the intended VDAB package before changing the builder App resource. Preserve the existing branch until the owner confirms the recovered installation is sound. Lakebase snapshot restore is not an in-place rollback.
4. For an independent disaster-recovery copy, make a PostgreSQL `pg_dump` backup using a current client compatible with the project's PostgreSQL version, store it in customer-approved protected storage, and rehearse `pg_restore` to a separate target. Use Databricks-managed authentication; never place database passwords, OAuth credentials, or customer data in Git or the test evidence. Lakebase cross-region Disaster Recovery is currently in Private Preview and its documentation says it is not intended for production use; do not treat it as the production recovery plan.

Official procedures: [Lakebase backup and restore methods](https://docs.databricks.com/aws/en/oltp/projects/backup-methods), [snapshots and schedules](https://docs.databricks.com/aws/en/oltp/projects/snapshots), [point-in-time branching](https://docs.databricks.com/aws/en/oltp/projects/point-in-time-branching), and [pg_dump/pg_restore](https://docs.databricks.com/aws/en/oltp/projects/pg-dump-restore). The cross-region preview status is documented in [Lakebase Disaster Recovery](https://docs.databricks.com/aws/en/oltp/projects/disaster-recovery).

### Uninstall and retained resources

Before uninstalling VDAB:

1. Export each project needed for portability and keep a database-level backup if deployment history, private source snapshots, audit records, or install data must be retained. Record the builder package revision and App configuration without copying secret values.
2. Stop new builder and child-App deployments. Decide whether each child App and its user-uploaded `.vdab/deployments/` source folder will stay active, be transferred, or be removed through the customer's workspace process. VDAB does not automatically delete child Apps or workspace source folders when its own App is removed.
3. Remove the builder App through the Databricks workspace procedure. Confirm separately that the bound Lakebase project, child Apps, source folders, and resource grants still exist or were removed as intended. Redeployment/stop of the builder does not itself delete Lakebase data.
4. Only remove the Lakebase resource or database after the data owner has validated backup and retention. Databricks' [Lakebase App resource documentation](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase) describes object ownership changes on resource removal: an operator without `CAN MANAGE` may leave the service-principal role and owned objects for later cleanup.

| Resource                                     | Effect of removing the VDAB builder App                                               | Owner action                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Lakebase database and VDAB schema            | VDAB does not issue database deletion as part of uninstall; project state can remain. | Keep, export, or delete through the approved Lakebase owner workflow after a verified backup.                                |
| Child Databricks Apps                        | VDAB does not cascade-delete created or linked Apps.                                  | Decide per child App; inspect ownership, resource grants, and active viewers before removal.                                 |
| Child-App Workspace Files source             | VDAB does not clean up its per-user source folders during builder uninstall.          | Retain while child rollback is needed; otherwise remove with the workspace owner after validating the child's active source. |
| VDAB project export files and saved packages | They are customer-managed copies, not deleted by uninstall.                           | Apply the customer's retention and secure-storage policy.                                                                    |

### Monitoring and troubleshooting

- **Builder does not start:** inspect the Databricks Apps deployment status and app logs. Confirm the packaged command and `DATABRICKS_APP_PORT` binding; use the app's Deployment history to identify the source revision. Do not expose environment-variable values in screenshots.
- **Migration or database connection fails:** verify the `postgres` Lakebase resource key, the resource's `Can connect and create` permission, expected injected variables, and migration log outcome. Do not manually edit the migration ledger or retry a partially applied schema change without checking the recorded migration status and current snapshot.
- **A workspace selector is empty or denied:** verify the signed-in user's required scope/consent and resource permission in the hosting workspace. An empty result, denial, and missing consent should remain distinct. VDAB intentionally does not switch to its service principal for a denied user action.
- **A child-App deployment is pending or failed:** record the non-secret app/deployment IDs and status, inspect the child App's deployment logs and source-folder read grant, then use VDAB's retry or rollback from its saved immutable source snapshot after confirming the target. Do not assume Databricks provides a one-click deployment rollback.
- **Generated Streamlit behavior differs from preview:** inspect the generated App's own logs and verify its App scopes, attached resources, and viewer permissions in the target workspace. Local generated-runtime mocks are not workspace evidence.
- **After any incident:** capture sanitized timestamps, status codes, revision/deployment IDs, expected and observed results, and recovery action in the manual evidence template. Never include tokens, secrets, raw authorization headers, database credentials, or customer data.

### Supported platform scope

Databricks Apps requires serverless compute availability in the target workspace region and the workspace's egress policy must permit the Apps runtime. Node dependencies are installed during deployment from the packaged `package.json`; allow the configured npm registry (Databricks lists `registry.npmjs.org` for Node package downloads) or have the workspace admin configure the supported default npm registry. Do not store npm registry credentials in this repository or in the package. Generated Lakebase-backed child Apps also need access to their configured Python package source for the approved `asyncpg==0.32.0` dependency. VDAB's durable store requires a Lakebase Autoscaling region as well. The current [Databricks Apps environment prerequisites](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/configure-env), [Apps networking guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/networking), [Apps dependency guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/dependencies), and [Lakebase region list](https://docs.databricks.com/aws/en/oltp/projects/manage-projects#region-availability) are platform requirements, not VDAB qualification evidence. The Lakebase guide currently lists AWS regions `us-east-1`, `us-east-2`, `us-west-2`, `ca-central-1`, `sa-east-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `ap-south-1`, `ap-southeast-1`, `ap-southeast-2`, and `ap-northeast-1`. VDAB has not been installed or tested in any cloud/region; validate both Apps and Lakebase support and all enabled feature scopes before declaring a combination supported. Azure, GCP, government, and China workspaces are not qualified by this runbook.

## Workspace verification checklist

Record the workspace host and app identifier without secrets, CLI version, source path, deployment status, and timestamp. Then verify:

- First install and update complete from `.build/`; the App starts and remains reachable after restart.
- Lakebase migrations apply to the bound customer database, and project state persists across restart and redeploy.
- Sign-in, proxy identity, project ACLs, installation recovery allowlist, and consent work for owner, editor, and denied viewer.
- Catalog/schema/table discovery, SQL reads/writes, Volume listing/upload, Jobs listing/Run Now, Genie, and serving endpoints use the intended user identity and scopes; denied actions do not fall back to App identity.
- Configure an optional default SQL warehouse and verify a UC-bound generated App receives the deterministic `sql_warehouse` resource and `valueFrom` environment binding; verify missing/invalid defaults block before deployment and SQL still uses the viewer's token.
- Generated Python/Streamlit output is launched and exercised in the workspace. Test all eight story visualizations and the complete workflow action set with representative authorized and denied resources.
- Child-App create-new, link-existing, deploy, retry/recovery, and standalone project export/import are exercised as an ordinary authorized user and a denied user. Confirm App-to-App creation only if the installed instance is explicitly allowed to do it.
- Record app logs, migration results, database durability, and unsupported behavior without including tokens, secrets, customer data, or generated credentials.

Until those checks run, local smoke results are not workspace, Lakebase durability, child-App, or Streamlit evidence.

The full manual test sequence, transition-gate table, no-secret evidence template, and external Marketplace checks are in [manual-workspace-testing.md](../.documentation/databricks-app-transition/manual-workspace-testing.md). No Databricks connection is made by the local commands in this guide.

## External Marketplace gate

Databricks' [third-party App consumer guide](https://docs.databricks.com/aws/en/marketplace/get-started-consumer) documents vendor submission followed by comprehensive security review, consumer configuration of App resources/scopes during install, and update notices when new versions are available. Public provider enrollment is through the [Data Partner Program](https://docs.databricks.com/aws/en/marketplace/become-provider); private-exchange-only providers can use the provider console as an account admin. These general docs do not establish VDAB's eligibility, its exact App submission channel, review acceptance, commercial terms or paid-App entitlement behavior, or a successful VDAB install/update/rollback. Complete those release gates and run the clean second-workspace install before publication.
