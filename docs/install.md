# Xorbix Visual Databricks App Builder (VDAB)

VDAB is a Marketplace Databricks App for visually designing, previewing, and deploying Python/Streamlit apps in the workspace where it is installed. Builder projects and history live in a customer-owned Lakebase Autoscaling database. Creating a project with the wizard also submits its initial Databricks child App deployment.

This README is the install, update, and user guide. The engineering references remain in [`docs/`](README.md).

## 1. Requirements and shell

- Databricks workspace with Databricks Apps and Lakebase Autoscaling enabled.
- A workspace user allowed to create/manage the builder App, bind its Lakebase resource, upload its source, and deploy it.
- A PostgreSQL/Lakebase owner who can grant schema access and approve the VDAB migrations.
- Git, Node.js 22.16+ with npm, and the standalone Databricks CLI (0.295.0 or newer supporting `apps deploy`, `apps create-update`, and `sync`).
- A POSIX-compatible shell (`bash`, `zsh`, or `sh`) for the commands below.

**Windows:** these Unix-style commands work in Git Bash or WSL. They are not PowerShell commands. With WSL, install Node, Git, and the Databricks CLI inside WSL and authenticate there; WSL and Windows have separate CLI profiles. Git Bash can use Windows-installed tools and the Windows CLI profile when they are on `PATH`.

Databricks CLI installation: [official instructions](https://docs.databricks.com/aws/en/dev-tools/cli/install). The CLI authenticates separately from your browser session.

## 2. Set the installation values and authenticate

Run these commands in a terminal at the repository root. Replace the generic values with your own. Keep the profile, App, and source folder consistent for all later commands.

```sh
export DATABRICKS_HOST='https://YOUR-WORKSPACE-HOST'
export DATABRICKS_PROFILE='vdab-workspace'
export WORKSPACE_USER='you@company.com'
export APP_NAME='vdab-builder'
export WORKSPACE_SOURCE="/Workspace/Users/${WORKSPACE_USER}/vdab-databricks"
export REPO_ROOT="$(pwd)"

test -f "$REPO_ROOT/src/databricks-app/package.json" || {
  echo 'Run this from the VDAB repository root.' >&2
  exit 1
}

databricks version
node --version
npm --version
databricks auth login --host "$DATABRICKS_HOST" --profile "$DATABRICKS_PROFILE"
databricks current-user me --profile "$DATABRICKS_PROFILE" --output json
```

Confirm `userName` is the intended workspace user. If you need a checkout, clone your approved repository first and `cd` into it. A clone contains committed changes only; deploy the approved commit/revision.

## 3. First-time builder setup

Skip this section when updating an existing `vdab-builder` installation. For a new installation, do these steps in the Databricks workspace UI:

1. Open **Databricks Apps** and create a **custom app** using the `APP_NAME` value set above. Use workspace-folder deployment if your workspace policy permits it.
2. Create/select a dedicated customer-owned Lakebase Autoscaling project, branch, and database for this installation.
3. Bind the database under **App resources** with resource key `postgres` and permission **Can connect and create**. The App deployment receives its `PG*` environment values from this binding. Do not copy credentials into source or `app.yaml`.
4. Give trusted maintainers `CAN_MANAGE` and app users `CAN_USE`. Give the App service principal read access to its source folder and parent folders as required by workspace policy.
5. In **User authorization**, configure only the organization-approved scopes needed by your features. Child-App discovery/deployment needs `apps` and `workspace.workspace`; AI Builder needs `model-serving`; other features may need `sql`, `postgres`, `files`, `genie`, or supported catalog read scopes. An App scope must also be allowed by workspace/Space policy and consented to by each user.

Check the effective scope policy read-only from the terminal:

```sh
databricks api get /api/2.1/settings/allowedAppsUserApiScopes \
  --profile "$DATABRICKS_PROFILE" --output json
```

Inspect `effective_allowed_apps_user_api_scopes.allowed_scopes`. Ask a workspace administrator to adjust a restricted policy; do not widen an organization allowlist as a workaround. Databricks documents App authorization and scope configuration [here](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth).

### Lakebase schema access

VDAB migrations create objects in PostgreSQL schema `public`. The bound database permission alone may not include schema `CREATE`. Before first startup, have the database/schema owner open the **Lakebase project's PostgreSQL SQL Editor**, select the database and branch bound to this App, and run the following there. Replace the role placeholder with the App's `service_principal_client_id` from `databricks apps get`; do not use the OAuth integration ID or your email.

```sh
databricks apps get "$APP_NAME" --profile "$DATABRICKS_PROFILE" --output json
```

```sql
SELECT current_database(), current_user;
SELECT rolname FROM pg_roles WHERE rolname = 'APP_SERVICE_PRINCIPAL_CLIENT_ID';
GRANT USAGE, CREATE ON SCHEMA public TO "APP_SERVICE_PRINCIPAL_CLIENT_ID";
SELECT
  has_schema_privilege('APP_SERVICE_PRINCIPAL_CLIENT_ID', 'public', 'USAGE') AS can_use_schema,
  has_schema_privilege('APP_SERVICE_PRINCIPAL_CLIENT_ID', 'public', 'CREATE') AS can_create_tables;
```

Confirm the role lookup returns a row and both checks are `true`. Obtain the database owner's approval for the initial schema creation/upgrade. Startup runs the reviewed append-only migrations automatically; do not manually create VDAB tables or edit the migration ledger. Existing tables owned by a different App may require a separate ownership review.

## 4. Build, upload, and deploy the builder

Run locally from the repository root. The build creates the self-contained deployment package in the Git-ignored `src/databricks-app/.build/` directory.

```sh
cd "$REPO_ROOT/src/databricks-app"
npm run install:all
npm run build
npm run smoke
cd "$REPO_ROOT"
```

Stop if any command fails. `npm run build` typechecks, runs the backend tests, builds the client, and packages the app. `npm run smoke` checks the assembled package.

Upload the package contents to the stable workspace source folder. Explicit include patterns are important because `.build/` is Git-ignored:

```sh
databricks sync src/databricks-app/.build "$WORKSPACE_SOURCE" \
  --profile "$DATABRICKS_PROFILE" --full \
  --include 'app.yaml' --include 'package*.json' --include '*.md' \
  --include 'public/**' --include 'server/**'

databricks workspace list "$WORKSPACE_SOURCE" \
  --profile "$DATABRICKS_PROFILE" --output json
```

Confirm `app.yaml`, `package.json`, `package-lock.json`, `public/`, and `server/` are directly inside `$WORKSPACE_SOURCE`. In the workspace UI, confirm the App service principal can read this folder.

Check the current compute/deployment state first. Run `apps start` only when compute is `STOPPED`; wait for `ACTIVE` and for any automatic restart deployment to finish before submitting another deployment.

```sh
databricks apps get "$APP_NAME" --profile "$DATABRICKS_PROFILE" --output json
```

If that output says `compute_status.state` is `STOPPED`, start it:

```sh
databricks apps start "$APP_NAME" --profile "$DATABRICKS_PROFILE"
```

After compute is `ACTIVE` and any previous deployment has finished, deploy:

```sh
databricks apps deploy "$APP_NAME" --source-code-path "$WORKSPACE_SOURCE" \
  --mode SNAPSHOT --profile "$DATABRICKS_PROFILE"
databricks apps get "$APP_NAME" --profile "$DATABRICKS_PROFILE" --output json
```

Verify the deployment is `SUCCEEDED`, compute is `ACTIVE`, App status is `RUNNING`, and the returned URL opens. See the [Databricks Apps deployment instructions](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy).

## 5. Fix the Apps-list authorization error

These are separate checks: the App must request `apps`, workspace policy must allow it, the scope must be effective, **and the current user must consent to it**. A successful CLI Apps request does not prove the browser's forwarded App token has the scope.

Inspect the App:

```sh
databricks apps get "$APP_NAME" --profile "$DATABRICKS_PROFILE" --output json
```

Confirm `apps` appears in both `user_api_scopes` and `effective_user_api_scopes`. Then inspect your own saved consent using the App's `oauth2_app_client_id` from that output:

```sh
export OAUTH_CLIENT_ID='PASTE_OAUTH2_APP_CLIENT_ID_HERE'
databricks api get "/api/2.0/oauth-app-integrations/${OAUTH_CLIENT_ID}/user-consent/me" \
  --profile "$DATABRICKS_PROFILE" --output json
```

Check the `user_consented_scopes` array. `apps` must be present. If it is missing, close existing VDAB tabs, open a **new private/incognito session**, visit the App URL, sign in as the intended workspace user, and approve the updated scope request. Check consent again. If no request appears, resetting your own consent for this one App is a change and will require you to authorize again:

```sh
databricks api delete "/api/2.0/oauth-app-integrations/${OAUTH_CLIENT_ID}/user-consent/me" \
  --profile "$DATABRICKS_PROFILE"
```

After the reset, use a completely new private browser session to sign in and consent, then rerun the read-only `GET`. Revocation does not immediately invalidate already issued tokens, so a fresh browser session matters. See [Databricks OAuth consent management](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m#manage-your-oauth-consent).

In the same signed-in browser, verify these routes on the App URL:

```text
/api/v1/session
/api/v1/setup/diagnostics
/api/v1/workspace/apps?pageSize=1
```

The last route should return HTTP 200 (an empty `items` list is okay). Do not copy cookies, authorization headers, tokens, or an unredacted HAR into logs/issues.

The setup diagnostics page may say it cannot verify consent if the workspace blocks the consent-inspection API for the forwarded App token. That message alone does not prove the feature scope is missing: check `user_consented_scopes` with the CLI and exercise the feature route directly. In this workspace, `/api/v1/workspace/apps` returns the workspace Apps list even though the diagnostics consent check is unavailable.

### Common deployment problems

| Error | Check |
|---|---|
| `permission denied for schema public` / PostgreSQL `42501` | Lakebase SQL Editor on the exact bound database: role exists and has `USAGE` and `CREATE` on `public`. |
| Apps error and `apps` missing from effective scopes | App authorization configuration and workspace/Space OAuth scope policy. |
| `apps` effective but absent from `user_consented_scopes` | User consent and a fresh private browser session. CLI login alone does not refresh the browser's App token. |
| Existing database object says `must be owner` | Inspect table ownership; have the database owner review the existing installation. Do not drop tables or grant broad ownership. |
| Sync succeeds but deployed UI is stale | Confirm explicit includes, uploaded files, profile, source folder, and deployment status. |
| Deployment already in progress | Wait for current/automatic deployment to finish before retrying. |
| Empty resource picker or 403 | Check both caller consent and that caller's resource permissions, plus resource bindings on the target child App. |

## 6. Use VDAB to build and deploy a child app

### Create a project

1. Open the running VDAB builder and select **Apps → Create New App**.
2. Confirm the installed workspace and choose **Create a new App** if you want VDAB to create a new Databricks child App. Use **Link an existing App** only when you intend to replace/manage an existing target.
3. Enter a project name and a unique child App name (2–30 lowercase letters, numbers, or hyphens). The wizard creates the project, submits its initial deployment, and opens the Canvas. If deployment fails, open **Settings → Deployment** to retry.
4. If this is the first workspace use, run **Workspace setup → Check workspace setup**. Resolve consent and permission issues before using workspace-backed pickers.

### Design, configure, and save

1. In **Canvas**, drag components from the catalog onto the page. Select a component to change labels, properties, layout, and data bindings.
2. In **Workflow**, add a workflow and actions. For a button, select its `onClick` trigger and connect it to the workflow event/action. Save and check validation messages.
3. Optionally choose **Prompt** from the builder toolbar to open AI Builder on the current section (Canvas, Workflow, Code, or Settings). Pick a ready chat endpoint you can query (not an embedding endpoint). A successful proposal is applied to the current draft automatically when the draft has not changed during generation; if the draft changed during generation, use **Apply proposal to draft**. In a real workspace, confirm this with a chat endpoint you can query. Local-test mode uses `sample-chat-endpoint`, which returns a tool call and applies a title to the draft.
4. In **Settings → App Details**, set the child App's workspace folder and confirm the saved target. Reopen the project to verify persistence.
5. In **Settings → Resources**, manage the child App's resource grants. The acting user needs permission to use the resources; the child App has its own identity and grants.
6. Save before previewing or deploying. Deployment uses the saved project version.

### Deploy and run the generated child App

1. Select **Deploy** in the builder header or on an Apps card. VDAB saves the current draft, writes the generated source to `<workspacePath>/.vdab/deployments/<projectId>/<deploymentId>`, and starts the Databricks App deployment. When the App URL is available, the current window opens that App page.
2. If the child App name or workspace folder is missing, Deploy opens App Details and focuses those fields. Genie Chat and Model Chat block deploy until each component is bound to a matching App resource under **Settings → Resources** (Genie space or serving endpoint with CAN_QUERY/CAN_MANAGE). **Settings → Deployment** remains the place for history, retry, and rollback. Start Databricks Job workflows deploy with the other workflow actions.
3. Return to VDAB's Apps dashboard to check the child App status. **Open** launches the live App URL, **Edit** reopens Settings, and **Deploy** starts the same deployment.

### Update and recover

- **Update the builder:** rebuild, sync to the same `$WORKSPACE_SOURCE`, and redeploy the same `$APP_NAME`. Do not recreate its App or Lakebase database for source updates.
- **Update a child App:** edit and save its VDAB project, then deploy the saved version for its linked child App. Check deployment history and retry after resolving the reported failure.
- **Restore child source:** use the project's restore action to redeploy the last successful saved snapshot.
- **Recover project data:** use Lakebase backups/PITR. A source rollback does not roll back database migrations or project data.
- **Import/export:** Apps → Import a standalone project accepts a `.vdab.json` project or collection bundle. **Export all Apps** exports the projects visible to the caller. Rebind resources after import; exports contain no credentials or grants.

## 7. Local-only development

From the repo root:

```sh
cd src/databricks-app
npm run install:all
npm run build
npm run smoke
VDAB_AUTH_MODE=local-test VDAB_LOCAL_USER_ID=local-editor NODE_ENV=development npm run start:packaged
```

Open `http://localhost:8000/`. `local-test` is a development-only identity adapter and is not evidence of Databricks authorization or runtime behavior.

## Further engineering references

- [Product and engineering documentation](README.md)
- [Architecture](architecture.md)
- [API reference](api-reference.md)
- [Generated application behavior](generated-applications.md)
- [Security and identity](identity-and-security.md)
- [Repository contribution rules](../AGENTS.md)

The deployment package is `src/databricks-app/.build/`, not the repository root.
