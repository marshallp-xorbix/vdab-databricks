# VDAB workspace install and update

This runbook separates reproducible local package preparation from Databricks workspace actions. The CLI sequence below follows current Databricks workspace-source deployment documentation; it has **not** been executed for VDAB. The user currently has no disposable development workspace and instructed us not to connect.

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

The release directory is `databricks-app/.build/`. It contains the production Node manifest and lockfile, `app.yaml`, server TypeScript source, and compiled client assets under `public/`. Deploy only `.build`; the repository root contains legacy SaaS/.NET source and is not the Databricks App package.

To start the packaged app locally for a local-only check:

```powershell
$env:VDAB_AUTH_MODE = "local-test"
$env:VDAB_LOCAL_USER_ID = "local-editor"
npm run start:packaged
```

The `local-test` adapter is in-memory, loses data on restart, and must not be enabled for a deployed App.

## Workspace prerequisites

Use a workspace where you are authorized to create or manage Apps and where a customer-owned Lakebase Autoscaling project, branch, and database are available. Add the database to the App as a resource with the key `postgres` and `Can connect and create` permission. Databricks currently injects `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGSSLMODE`; `app.yaml` maps `LAKEBASE_ENDPOINT` from the `postgres` resource. The App exchanges short-lived OAuth credentials for a short-lived Lakebase password. No static database password belongs in this repository. See [Databricks Lakebase App resource documentation](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase).

Set `VDAB_INSTALL_ADMIN_IDS` in the App's environment configuration to a comma-separated list of Databricks user IDs authorized for the installation recovery role. This is an explicit install-maintained list; it does not infer workspace-admin rights.

Configure user authorization scopes in the Databricks Apps UI or the `user_api_scopes` CLI property, and require each user to consent. Current Apps documentation lists `sql`, `files`, `genie`, `model-serving`, `apps`, `postgres`, and granular catalog SDK scopes. It does not list `jobs`, a Volume-list scope matching the direct endpoint's documented `unity-catalog` scope, `scim`, or `identity`. Direct API/scope combinations for resource discovery, Jobs, and model-serving inference need a workspace feasibility test. Do not invent a scope or retry a denied user action using the App service principal. See [Databricks Apps authorization and supported scopes](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth).

The presence of an `apps` scope does not prove that an installed VDAB Marketplace instance may create another App. Child-App create-new, link-existing, deployment, consent, and permission flows remain a separate feasibility spike. Do not claim those live flows until they are exercised in an authorized disposable workspace.

## First install (workspace procedure; unverified for VDAB)

1. Authenticate the Databricks CLI to the intended development workspace and confirm the active profile and host locally. Do not paste tokens or credential output into logs or this repository.
2. Build and smoke-test `.build/` as above.
3. Create a custom Databricks App named `vdab-builder` in the workspace UI, or with `databricks apps create vdab-builder`. Configure approved user scopes and bind the `postgres` Lakebase Autoscaling resource before deployment. The local package does not provision a Lakebase project or database.
4. From the repository root, upload the built package and deploy it from its workspace path:

   ```powershell
   databricks sync .\databricks-app\.build /Workspace/Users/<your-email>/vdab-builder-source
   databricks apps deploy vdab-builder --source-code-path /Workspace/Users/<your-email>/vdab-builder-source
   ```

   Workspace-folder deployment follows [Deploy a Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy?language=Databricks+CLI) and the [`apps` CLI command reference](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands). These commands document the current CLI shape; they have not been run for VDAB.
5. Inspect deployment status and App logs in the Databricks Apps UI. Confirm the App starts with `VDAB_AUTH_MODE=databricks`, migrations complete, and expected resource/environment variables are present without exposing their values. First use should exercise sign-in and configured user consent.

Workspace CLI versions, permissions, network policy, resource binding, and installation behavior still need validation in the target workspace.

## Update and rollback

For an update, rerun local install/build/smoke, sync the new `.build/` contents to the same workspace source path, and deploy the existing App from that path. Databricks updates the App deployment without recreating the App. Keep each tested `.build/` artifact or source revision available for recovery; workspace-source rollback requires restoring the previous package contents and deploying again. Check deployment history and logs after each update. See [Update or redeploy a Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy?language=Databricks+CLI#update-or-redeploy-the-app).

## Workspace verification checklist

Record the workspace host and app identifier without secrets, CLI version, source path, deployment status, and timestamp. Then verify:

- First install and update complete from `.build/`; the App starts and remains reachable after restart.
- Lakebase migrations apply to the bound customer database, and project state persists across restart and redeploy.
- Sign-in, proxy identity, project ACLs, installation recovery allowlist, and consent work for owner, editor, and denied viewer.
- Catalog/schema/table discovery, SQL reads/writes, Volume listing/upload, Jobs listing/Run Now, Genie, and serving endpoints use the intended user identity and scopes; denied actions do not fall back to App identity.
- Generated Python/Streamlit output is launched and exercised in the workspace. Test all eight story visualizations and the complete workflow action set with representative authorized and denied resources.
- Child-App create-new, link-existing, deploy, retry/recovery, and standalone project export/import are exercised as an ordinary authorized user and a denied user. Confirm App-to-App creation only if the installed instance is explicitly allowed to do it.
- Record app logs, migration results, database durability, and unsupported behavior without including tokens, secrets, customer data, or generated credentials.

Until those checks run, local smoke results are not workspace, Lakebase durability, child-App, or Streamlit evidence.

## External Marketplace gate

This repository and the local package do not establish Marketplace provider approval, listing eligibility, commercial terms, security review, publication, or consumer installation in a second workspace. Databricks documents provider enrollment separately: [Become a Databricks Marketplace provider](https://docs.databricks.com/aws/en/marketplace/become-provider). Those actions and successful customer-workspace installation remain external gates.
