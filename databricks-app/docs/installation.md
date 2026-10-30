# Install VDAB and verify the complete setup

Follow this guide in order for a new installation. For an existing App that reports an Apps-scope error, set the variables and authenticate in steps 1–2, then use [step 8](#8-verify-each-users-consent-and-start-a-fresh-app-session) without recreating the App or database. Adding an App scope and consenting to that scope are separate operations.

These instructions install the Node/React VDAB builder. Generated applications are separate Python/Streamlit Apps. Each workspace installation has its own customer-owned Lakebase database and starts with empty VDAB state.

## Where to run each step

| Location | Used for | Identity |
|---|---|---|
| Local PowerShell terminal, in your source checkout | Build, CLI authentication, upload, App configuration, read-only checks | Installer's Databricks user |
| Databricks workspace browser, App management page | Create/configure the builder, resource bindings, source-folder access, deployment logs | App manager |
| Lakebase project's PostgreSQL SQL Editor, selected branch and database | Schema grants and migration verification | Database/schema owner |
| VDAB runtime URL in a fresh browser session | OAuth consent, setup checks, project creation and child deployment | Each actual VDAB user |

The SQL below runs in **Lakebase PostgreSQL**, not a Databricks SQL warehouse or Unity Catalog SQL editor. Commands marked as changes are for the installer or administrator to run intentionally; read-only checks do not apply those changes.

## 1. Prepare the machine and installation values

**Where: local machine.** Use PowerShell 7 on Windows, macOS, or Linux for the command blocks in this guide. Do not paste PowerShell commands into Bash. Install Git, Node.js 22.16 or later with npm, and the modern standalone Databricks CLI. The CLI JSON syntax below was checked against version 0.295.0; use that version or a newer version supporting these commands, not the legacy Python CLI.

On Windows, if the CLI is absent:

```powershell
winget install Databricks.DatabricksCLI
```

Restart the terminal after installation. For other operating systems, follow the [official CLI installation instructions](https://docs.databricks.com/aws/en/dev-tools/cli/install). Obtain PowerShell through the [PowerShell installation guide](https://learn.microsoft.com/powershell/scripting/install/installing-powershell), and Node through [Node.js](https://nodejs.org/en/download).

```powershell
$PSVersionTable.PSVersion
git --version
node --version
npm --version
databricks version
databricks apps create-update --help
```

Get the approved VDAB source revision from your maintainer. A fresh clone only includes committed changes; local uncommitted fixes on another machine are not part of that clone.

If you do not have a checkout, replace the repository URL below with your organization's approved URL and run this in a local parent directory. Authenticate to the Git provider when requested; that login is separate from Databricks:

```powershell
git clone 'REPLACE-WITH-APPROVED-REPOSITORY-URL' 'vdab-databricks-app'
if ($LASTEXITCODE -ne 0) { throw 'Source checkout failed.' }
Set-Location './vdab-databricks-app'
```

Open PowerShell in the repository root, then set these values once. Replace the examples for your own workspace; keep the same values in later steps:

```powershell
$ErrorActionPreference = 'Stop'
$repoRoot = (Get-Location).Path
$workspaceHost = 'https://YOUR-WORKSPACE-HOST'
$profileName = 'vdab-company'
$workspaceUser = 'you@company.com'
$appName = 'vdab-builder'
$workspaceFolder = "/Workspace/Users/$workspaceUser/vdab-databricks"

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'databricks-app/package.json'))) {
  throw 'Open this terminal in the VDAB repository root first.'
}
```

For Patrick's company installation, use this values block instead:

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\PatrickMarshall\Desktop\repos\vdab-databricks-app'
$repoRoot = (Get-Location).Path
$workspaceHost = 'https://dbc-bc2a5dd3-798c.cloud.databricks.com'
$profileName = 'xorbix-vdab-company'
$workspaceUser = 'patrick.marshall@xorbix.com'
$appName = 'vdab-builder'
$workspaceFolder = '/Workspace/Users/patrick.marshall@xorbix.com/vdab-databricks'
```

Run blocks individually. Stop if a command fails; PowerShell's error preference alone does not stop every failed native executable, so the build/update blocks check their exit codes explicitly.

## 2. Authenticate and check workspace policy

**Where: local PowerShell. Changes: creates/refreshes your local CLI login.**

```powershell
databricks auth login --host $workspaceHost --profile $profileName
if ($LASTEXITCODE -ne 0) { throw 'Databricks CLI login failed.' }
databricks current-user me --profile $profileName --output json
```

Verify the returned `userName` matches `$workspaceUser`. Every person needs their own CLI login/profile. The browser user must also be the intended user; the CLI and browser have separate sessions.

**Where: workspace browser, with an administrator if required.** Confirm Databricks Apps and Lakebase Autoscaling are available, you may create/manage the builder, and workspace-folder App deployment is allowed. If the workspace enforces Git-only deployment, use the company's approved Git release process for the packaged artifact; the repository root is not a deployable VDAB package. For App Spaces, obtain permission to create the builder and child Apps in the selected Space and confirm its scope policy supports the intended features.

**Read-only policy check, local PowerShell:**

```powershell
databricks api get /api/2.1/settings/allowedAppsUserApiScopes `
  --profile $profileName --output json
```

Inspect `effective_allowed_apps_user_api_scopes.allowed_scopes`. `['*']` permits all supported scopes; a restricted list must include the scopes approved for your installation. An administrator manages this under workspace **Settings > Development > Apps > Restrict OAuth scopes**. Do not replace an organizational allowlist with `*` as an installation shortcut.

Use the raw `api get` check above: older CLI typed settings commands can omit unfamiliar response fields and show only the setting name. Missing fields are not proof that the policy allows or denies a scope. See [App authorization policy](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth).

## 3. Create the builder and bind Lakebase

**Where: workspace browser. Who: installer/App manager and Lakebase project manager. Changes: creates/configures the App and database binding.**

1. Create or select a dedicated customer-owned Lakebase Autoscaling project, branch, and database approved for this VDAB installation. Record the **actual PostgreSQL database name** from Lakebase's connection details; its resource ID can differ from that SQL database name.
2. Open **Databricks Apps > Create app > Create a custom app**. Use `$appName`; choose workspace-folder deployment when permitted. For an existing installation, edit the existing App instead of recreating it.
3. Add the intended Lakebase database under **App resources > Add resource > Database**. Select its project, branch, and database. Set resource key **`postgres`** and permission **Can connect and create**. The person binding it needs `CAN MANAGE` on the Lakebase project.
4. Give trusted maintainers `CAN_MANAGE` on the builder and intended users `CAN_USE`. These App permissions do not grant access to their underlying data or other workspace resources.
5. Do not deploy yet; finish the database grants and scopes below first.

Binding the resource creates/reuses the App's PostgreSQL role and supplies `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGSSLMODE`. The committed `app.yaml` supplies `LAKEBASE_ENDPOINT` through `valueFrom: postgres`. Keep production `VDAB_AUTH_MODE=databricks`. Databricks supplies the App identity and workspace runtime context; do not copy sandbox secrets, access tokens, or local-test settings into the company App. See [Lakebase resource setup](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase).

**Read-only binding/identity check, local PowerShell:**

```powershell
$appJson = databricks apps get $appName --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not read the builder App.' }
$appInfo = $appJson | ConvertFrom-Json
$appInfo | Select-Object name, service_principal_client_id, oauth2_app_client_id, resources
databricks apps get-permissions $appName --profile $profileName --output json
```

Check the exact bound project/branch/database before proceeding. Use these two different IDs correctly:

| Field | Purpose |
|---|---|
| `service_principal_client_id` | App's PostgreSQL role; matches runtime `PGUSER` / `DATABRICKS_CLIENT_ID` |
| `oauth2_app_client_id` | App OAuth integration; used to inspect/reset each user's consent |

## 4. Grant PostgreSQL schema access before first startup

**Where: generate the statements in local PowerShell; execute their output in Lakebase SQL Editor on the bound branch/database. Who executes SQL: database/schema owner. Changes: grants access to the App role.**

VDAB's current migrations create tables in `public`. Database-level **Can connect and create** does not replace the required schema-level privileges. Generate the exact statements using the App identity you just read:

```powershell
$appPrincipalId = [string]$appInfo.service_principal_client_id
if ($appPrincipalId -notmatch '^[0-9a-fA-F-]{36}$') {
  throw 'Read the App service principal client ID before generating grants.'
}
@"
SELECT current_database() AS database_name, current_user AS administrator;
SELECT rolname FROM pg_roles WHERE rolname = '$appPrincipalId';

GRANT USAGE, CREATE ON SCHEMA public TO "$appPrincipalId";

SELECT
  has_database_privilege('$appPrincipalId', current_database(), 'CONNECT') AS can_connect,
  has_schema_privilege('$appPrincipalId', 'public', 'USAGE') AS can_use_schema,
  has_schema_privilege('$appPrincipalId', 'public', 'CREATE') AS can_create_tables;
"@
```

In Lakebase SQL Editor, confirm the selected database, run the role lookup first (one role must exist), then the grant and verification query. All three permission checks must be `true`. If the role is absent, recheck the selected database and App resource binding before proceeding. Do not grant to the installer's email, the OAuth integration ID, or the PostgreSQL `PUBLIC` group.

Obtain the database owner's/team lead's approval for VDAB's initial schema creation or upgrade before deployment. Startup applies the reviewed append-only migrations automatically. Do not manually create the VDAB tables or mark migrations as applied. Existing VDAB objects owned by a different App require an ownership review or a dedicated fresh database; broad table grants do not give the App permission to run ownership-dependent `ALTER TABLE` migrations. See [Databricks' schema grants](https://docs.databricks.com/aws/en/oltp/projects/tutorial-databricks-apps-autoscaling).

## 5. Configure and verify App user scopes

**Where: local PowerShell or App management > User authorization. Who: App manager. Changes: requested App user scopes.**

| Feature | Scope additions | Additional user/resource permission |
|---|---|---|
| Discover/manage/deploy child Apps | `apps`, `workspace.workspace` | Apps/Space permissions, source folder access |
| AI Builder and model endpoints | `model-serving` | Query access to a ready chat/function-calling endpoint |
| Unity Catalog discovery and SQL | `catalog.catalogs:read`, `catalog.schemas:read`, `catalog.tables:read`, `sql` | Catalog/schema/table privileges and usable SQL warehouse |
| Lakebase resource discovery | `postgres` | Access to selected Lakebase resources |
| Files and Genie features | `files`, `genie` | Access to selected files/Genie resources |

The builder database binding uses the App's identity; the `postgres` user scope is for caller-authorized workspace features. Configure only company-approved features. Do not invent a `jobs`, `scim`, or `unity-catalog` scope when it is not supported by the App scope picker/API; use the feature's readiness result and current Databricks documentation.

The following block includes the tested discovery/AI/deployment feature set. Edit `$scopeAdditions` to the approved set before running. It preserves scopes already configured on the App. If `apps` is absent from the UI picker, this is the CLI alternative; it does not bypass workspace or Space policy.

```powershell
$scopeAdditions = @(
  'apps', 'workspace.workspace', 'model-serving', 'postgres',
  'sql', 'files', 'genie',
  'catalog.catalogs:read', 'catalog.schemas:read', 'catalog.tables:read'
)
$appJson = databricks apps get $appName --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not read existing scopes; no update prepared.' }
$appInfo = $appJson | ConvertFrom-Json
$desiredScopes = @(@($appInfo.user_api_scopes) + $scopeAdditions | Sort-Object -Unique)
$requestBody = @{
  update_mask = 'user_api_scopes'
  app = @{ user_api_scopes = $desiredScopes }
} | ConvertTo-Json -Depth 5
$requestFile = Join-Path ([System.IO.Path]::GetTempPath()) 'vdab-user-scopes.json'
[System.IO.File]::WriteAllText($requestFile, $requestBody, [System.Text.UTF8Encoding]::new($false))

databricks apps create-update $appName --json "@$requestFile" --profile $profileName
if ($LASTEXITCODE -ne 0) { throw 'App scope update failed; review the exact policy/API error.' }

$appJson = databricks apps get $appName --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not verify updated scopes.' }
$appInfo = $appJson | ConvertFrom-Json
$appInfo | Select-Object user_api_scopes, effective_user_api_scopes
$missingEffective = @($scopeAdditions | Where-Object { $_ -notin $appInfo.effective_user_api_scopes })
if ($missingEffective.Count -gt 0) {
  throw "Scopes are not effective: $($missingEffective -join ', '). Resolve workspace/Space policy first."
}
```

With CLI v0.295.0 and `--json`, supply **only the App name** positionally and put `update_mask` in the JSON. Do not add a second positional `user_api_scopes` argument. Wait for the asynchronous update to succeed. This changes only the scope field and preserves resource bindings. See [App scope configuration](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth).

## 6. Build and upload the self-contained package

**Where: local PowerShell, current checkout. Changes: local build output and the chosen workspace source folder.**

```powershell
Set-Location (Join-Path $repoRoot 'databricks-app')
foreach ($buildStep in @('install:all', 'build', 'smoke')) {
  npm run $buildStep
  if ($LASTEXITCODE -ne 0) { throw "npm run $buildStep failed; do not deploy." }
}
Set-Location $repoRoot

databricks sync databricks-app/.build $workspaceFolder --profile $profileName --full `
  --include 'app.yaml' --include 'package*.json' --include '*.md' `
  --include 'public/**' --include 'server/**'
if ($LASTEXITCODE -ne 0) { throw 'Package upload failed.' }

databricks workspace list $workspaceFolder --profile $profileName --output json
```

The explicit includes prevent Git-ignore rules from silently skipping `.build`. Confirm uploaded files and a workspace folder containing `app.yaml`, `package.json`, `package-lock.json`, `public/`, and `server/` directly at its root. Select **this folder**, not the repository root or an extra nested `.build` folder, as the deployment source.

**Where: workspace browser > Workspace > chosen source folder > Permissions.** Ensure the App service principal can read this folder and that only trusted maintainers can edit source. Use the App service-principal identity from step 3. The App also needs to be able to read its parent folders as required by workspace policy. Do not use broad workspace-wide management grants for this.

## 7. Start compute, deploy, and verify migrations

**Where: local PowerShell; inspect deployment/logs in the workspace App management page. Changes: starts compute and deploys the builder; startup creates/upgrades its database schema.**

```powershell
$appJson = databricks apps get $appName --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not read compute state.' }
$appInfo = $appJson | ConvertFrom-Json
if ($appInfo.compute_status.state -eq 'STOPPED') {
  databricks apps start $appName --profile $profileName
  if ($LASTEXITCODE -ne 0) { throw 'App compute did not start.' }
}
databricks apps get $appName --profile $profileName --output json
```

Before the next command, confirm compute is `ACTIVE`. For an App deployed before, starting compute can automatically redeploy its previous source. Wait for that automatic deployment to finish (`SUCCEEDED`, `FAILED`, or `CANCELLED`) before submitting another deployment. On a first install, having no previous deployment is expected. Re-run the read-only `apps get` check or inspect the App management page rather than submitting repeated deployments during startup.

```powershell
databricks apps deploy $appName --source-code-path $workspaceFolder `
  --mode SNAPSHOT --profile $profileName
if ($LASTEXITCODE -ne 0) { throw 'Builder deployment failed; inspect App logs.' }
$appJson = databricks apps get $appName --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not verify deployment.' }
$appInfo = $appJson | ConvertFrom-Json
$appUrl = [string]$appInfo.url
$appInfo | Select-Object name, url, compute_status, app_status, active_deployment
```

Success requires the deployment to report `SUCCEEDED` and the App to report `RUNNING`. A reachable liveness route alone does not prove user permissions or all resources are ready.

**Read-only SQL, Lakebase SQL Editor on the same bound branch/database:**

```sql
SELECT migration_id, applied_at
FROM public.vdab_schema_migrations
ORDER BY migration_id;

SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'vdab_%'
ORDER BY tablename;
```

This revision includes migrations 001 through 008; the last is `008_project_deployment_settings`. Check the migration files in the release you actually deployed if installing a later revision. Table owners should be the intended App role. No table rows, credentials, or user tokens need to be exported for troubleshooting.

## 8. Verify each user's consent and start a fresh App session

**Where: local PowerShell for metadata checks, then the actual user's browser for consent. Who: every VDAB user, with their own CLI profile if running the checks.**

Configured/effective App scopes, a user's stored OAuth consent, and the token in an existing browser session are three different things. Successful CLI listing uses the CLI's token and does not prove the App's forwarded browser token has the same scopes.

**Read-only consent check:**

```powershell
$appJson = databricks apps get $appName --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Could not read OAuth integration metadata.' }
$appInfo = $appJson | ConvertFrom-Json
$oauthClientId = [string]$appInfo.oauth2_app_client_id
if (-not $oauthClientId) { throw 'The App OAuth integration ID is missing.' }
$appUrl = [string]$appInfo.url
$consentPath = "/api/2.0/oauth-app-integrations/$oauthClientId/user-consent/me"
$consentJson = databricks api get $consentPath --profile $profileName --output json
if ($LASTEXITCODE -ne 0) { throw 'Consent could not be read; do not treat it as verified.' }
$consent = $consentJson | ConvertFrom-Json
$consentedScopes = @($consent.user_consented_scopes)
$missingConsent = @($appInfo.effective_user_api_scopes | Where-Object { $_ -notin $consentedScopes })
[pscustomobject]@{
  AppUrl = $appUrl
  EffectiveScopes = @($appInfo.effective_user_api_scopes)
  ConsentedScopes = $consentedScopes
  MissingConsent = $missingConsent
} | ConvertTo-Json -Depth 5
```

Databricks' current consent response uses **`user_consented_scopes`**. Missing consent must be empty before claiming complete authorization. For the reported Apps-list failure, specifically check that `apps` is both effective **and consented**.

1. Close existing VDAB tabs. Open a **new private/incognito browser session** (close prior private windows first so an old private session is not reused).
2. Open `$appUrl`, sign in as the intended user in this workspace, and approve the updated authorization request. Closing/reopening a regular tab or re-running CLI login alone does not clear an existing App session.
3. Re-run the read-only consent check. `apps` must appear in `ConsentedScopes`; verify any other newly added scopes too.
4. In that fresh VDAB session, open **Workspace setup > Check workspace setup**, then test the actual affected feature. The current package recognizes `user_consented_scopes`; older builds can report unsupported consent metadata even when the CLI read works.

If consent remains stale and no new approval request appears, the user can reset consent for **this one App**. Save current work first. The following command is a **change**, not a read-only diagnostic; run it only when intentionally resetting your own VDAB consent:

```powershell
databricks api delete $consentPath --profile $profileName
if ($LASTEXITCODE -ne 0) { throw 'Consent reset failed.' }
```

Then open a completely new private browser session, open `$appUrl`, sign in and consent again, and repeat the GET verification. Revocation does not immediately invalidate already issued tokens; a fresh browser session is important. Do not revoke other users' consent or change global scope policy. See [Databricks OAuth consent management](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m#manage-your-oauth-consent).

**Check the real browser token without exposing it:** in the signed-in VDAB browser, open these URLs by appending the paths to `$appUrl`:

```text
/api/v1/session
/api/v1/setup/diagnostics
/api/v1/workspace/apps?pageSize=1
```

Verify the session belongs to the expected user/workspace and the Apps request succeeds (HTTP 200, even if its `items` array is empty). Use browser Developer Tools > Network to inspect only the response status, safe Problem Details, and request ID if necessary. Do not copy cookies, authorization headers, tokens, or an unredacted HAR. A diagnostics result of `unavailable` is not proof of permission; use the CLI consent check and the direct feature request to distinguish the failure.

## 9. Verify the complete user workflow

**Where: fresh signed-in VDAB browser. Changes: creates a small test project and generated child App.**

1. Create a new VDAB project through the Wizard, confirm the installed workspace, and choose **Create new App**. Give the child a unique 2–30-character lowercase App name.
2. Save the intended workspace folder in **Settings > App Details**. Save, return to Apps, reopen the project, and verify the folder/target persisted.
3. Drag a Button and Checkbox onto Main Page, change their labels/help, attach an `onClick` Trigger Toast workflow with a non-empty body, and save.
4. Open AI Builder, choose a ready chat endpoint that supports function calling and that you can query, request a small addition, review/apply it, and save. An embedding endpoint is not a chat model.
5. Review **Settings > Resources** readiness. Select/bind resources for the generated App as needed. Unity Catalog operations need a usable SQL warehouse and the acting user's data permissions. Resolve unsupported-resource/readiness errors before deployment.
6. Create/deploy the new child. Databricks may require Space creation rights and source-folder read access for that child App's service principal. VDAB waits for stopped child compute and its automatic restart deployment before submitting source; if startup exceeds the bounded wait, inspect state and explicitly retry the retained source once the cause is resolved.
7. Wait for a successful deployment, open the generated App, sign in/consent if requested, exercise its controls, and verify the toast event runs. Check the Apps card's status and Open action.
8. Reload/reopen the project and confirm state persists. A local smoke test, configured scope list, or green liveness check alone is not completion of this acceptance test.

## 10. Troubleshoot by the failed check

| Symptom | Check and next action |
|---|---|
| `permission denied for schema public` / PostgreSQL 42501 | Step 4 in the exact bound Lakebase database; verify `PGUSER` role, `USAGE`, and `CREATE`. Changing browser scopes does not fix PostgreSQL grants. |
| Permission denied on an existing VDAB table or `must be owner` | Inspect table owners in step 7. Have the database owner review the old installation/ownership; do not drop tables or apply blanket grants to conceal a migration ownership mismatch. |
| Apps-list error and `apps` absent from effective scopes | Step 5; check raw effective workspace policy/Space policy in step 2. |
| `apps` effective but absent from `user_consented_scopes` | Step 8: fresh browser session and updated user consent; use the one-App consent reset only when needed. This was the verified company failure on October 30, 2026. |
| CLI Apps list works but VDAB still gets 403 | CLI and browser tokens differ. Compare browser identity, stored App consent, and the direct browser API request in step 8. If all pass except the App request, retain its safe request ID/status for administrator/provider investigation. Do not retry as the builder service principal. |
| Scope picker omits `apps` | Use the narrow JSON update in step 5. Record exact unsupported/restricted-scope errors; CLI does not bypass policy. |
| CLI says `provide only APP_NAME` | Put `update_mask` inside JSON and remove the second positional argument, as in step 5. |
| Settings command returns only a name | Use raw `databricks api get /api/2.1/settings/allowedAppsUserApiScopes`; an older typed CLI can discard effective fields. |
| Sync succeeds but old UI appears / files absent | Confirm explicit includes, uploaded files, correct profile/folder, and successful deployment; `.build` is ignored by Git. |
| Deployment reports another deployment in progress | Wait for the existing/automatic restart deployment to finish; inspect read-only `apps get` before resubmitting. |
| Lakebase inputs missing | Check the first database binding, key `postgres`, and runtime presence of `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE`, `LAKEBASE_ENDPOINT`. Never print secrets. |
| Picker empty or feature denied after consent | Verify resource existence and the actual user's catalog/schema/table, warehouse, serving, Genie, or Lakebase permissions. A successful empty discovery result differs from a 403. |

For read-only CLI diagnosis of the user's underlying Apps access:

```powershell
databricks current-user me --profile $profileName --output json
databricks apps get-permissions $appName --profile $profileName --output json
databricks api get '/api/2.0/apps?page_size=1' --profile $profileName --output json
```

## 11. Update an existing installation

Keep the same App, source folder, service principal, and Lakebase binding. Rebuild/smoke/sync using step 6, then deploy using step 7. Install dependencies again when the lockfiles change or on a new checkout/machine. If adding scopes, repeat step 5 and require **each user** to complete step 8. Do not recreate the builder just to update source; a new App has a different database role and OAuth integration.

Read [deployment and operations](deployment-and-operations.md) for source rollback, database recovery, and uninstall. Database migrations are append-only; a source rollback does not roll back Lakebase data. Preserve backups and ownership before any recovery operation.
