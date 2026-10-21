# 2. Databricks feasibility spikes

**Depends on:** Product contract and access to a disposable Databricks workspace.  
**Output:** Reproducible evidence that the requested product is possible with customer-workspace permissions.

## Spike A: Native identity and child-app deployment

1. Create a minimal Node Databricks App with user authorization scopes needed for `apps` and any required files/workspace APIs. Bind to `0.0.0.0` and `DATABRICKS_APP_PORT`.
2. From the app, obtain the signed-in user's forwarded OAuth token and verify identity without accepting identity headers directly from an unauthenticated local request. Use the app identity only for shared/background work.
3. As a non-admin user with intended builder privileges, call Create App, upload or select source, bind representative resources, deploy, poll status, and inspect logs. Repeat through the installation configuration that Marketplace will impose, not merely a local CLI token.
4. Test a user lacking create/deploy permission and one lacking `apps` consent. Verify no fallback to the app service principal silently elevates their privileges.
5. Test redeploy, name collision, quota exhaustion, failed deployment, and source path permissions. Capture exact scope/permission matrix.

**Pass:** A representative user can create and deploy a second app from the installed builder under the intended identity; denied cases are correctly denied. **Fail:** Escalate the permission model or product design before porting deployment. Official Apps API support alone does not settle this.

## Spike B: Durable state and installation

1. Bind a customer-managed Lakebase Autoscaling database to a sample builder app. Verify installer prerequisites, connection environment, app service-principal role, and access after restart/redeploy.
2. Evaluate whether an install notebook or separate provisioning step is needed to create the Lakebase project/database before Marketplace install. Databricks documents that the user adding a Lakebase resource needs `CAN MANAGE` on the project.
3. Test initial schema creation, a future schema upgrade, and backup/export of a project created in the new product. Compare operational burden with Unity Catalog tables/volumes if Lakebase provisioning cannot meet the install journey.

**Pass:** An installer can set up durable storage using documented workspace permissions, and data survives app redeploy. **Fail:** Choose a different supported store and revise D4.

## Spike C: AI and generated child app

1. Run one AI builder operation against a customer workspace endpoint using the intended user/app identity and scopes. Verify streaming/tool calls, error handling, context size, and egress requirements.
2. Generate one representative Python/Streamlit child app with SQL binding, Job action, custom module, and resource reference. Configure user authorization, deploy it, and verify that two viewers with different Unity Catalog/Job grants see different allowed outcomes. Verify the child app's service principal cannot silently run denied user actions.
3. Verify the generated app's Python/Streamlit dependencies can be installed under the target workspace's network policy; check generated `app.yaml` and resource references.

**Pass:** Builder assistance and generated runtime function under customer permissions. **Fail:** Keep the relevant feature blocked, investigate supported authorization/resource patterns, and resolve the platform constraint with the user before changing the agreed parity scope.

## Spike D: Marketplace provider path

1. Ask the Databricks account/partner team for App listing submission, security review, closed-source package handling, private/public exchange support, updates/rollback, commercial flow, and entitlement signals.
2. Package a disposable preview version; perform an install and update in a second workspace as a consumer. Record required resources/scopes and any blocked operations.
3. Confirm whether commercial transaction completion is visible to the installed app. Do not infer entitlement from a Marketplace install or design a purchaser-token flow without evidence.

**Pass:** Written provider guidance plus successful consumer install/update. **Fail:** Keep Marketplace publication as an external blocker and document an approved distribution alternative.

## Evidence and cleanup

Keep spike code isolated from production paths. Record commands, API versions, Databricks workspace/cloud, user role, scopes, redacted HTTP responses, screenshots/log references, cost, and date in a `spike-results.md`. Tear down created child apps and test resources in the disposable workspace after capturing evidence. Do not store tokens or customer secrets in the repo.
