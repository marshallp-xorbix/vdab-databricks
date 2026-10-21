# 6. Child-app deployment and Marketplace distribution

**Depends on:** Successful G2/G4 spikes, builder generator, identity policy.  
**Output:** A workspace-native builder that can create and deploy child apps and can itself be installed and updated through the agreed Marketplace path.

## Child-app lifecycle

1. Implement explicit `create new` and `link existing` flows in the installed workspace. Validate name, the acting creator/collaborator's management permission, quota, source access, and resource prerequisites before changing remote state. For an existing app, show the target and current deployment, require confirmation before replacing code, and retain recovery information.
2. Generate a complete child-app source tree in a controlled temporary area; do not rely on runtime filesystem persistence. Select a deployment source supported by the customer's workspace policy (workspace files or Git). Account for admin-enforced Git-only deployment and private repository credentials per child app.
3. Create or update the Databricks App and bind **existing resources in the installed workspace** with the acting user's identity proven by G2. Do not create SQL warehouses, Jobs, Lakebase databases, model endpoints, or Unity Catalog assets. Separate resources granted to the builder from resources granted to each child app. Show required SQL warehouse, UC, Job, Lakebase, secret, and model permissions before deploy. Configure the child app's user authorization so viewer-triggered SQL and Jobs use each viewer's grants where Databricks supports it.
4. Upload/sync source, deploy, poll asynchronous status, expose logs, and persist version/source/deployment IDs. Handle name collision, retry after partial success, cancellation, rollback to last successful deployment, and failed resource grant without orphaning an app silently.
5. Enforce workspace app quota and transparent cost/compute information. Do not promise unlimited child apps; current Databricks limit is 100 apps per workspace.

## Marketplace package and installer journey

1. Produce a self-contained, reproducible, pinned Node package with `app.yaml`, manifest/resource/scopes documentation, license/third-party notices, SBOM if required by review, and a security review packet. Exclude local `.env`, test data, and secrets.
2. Define first-install prerequisites: Databricks Apps support, Unity Catalog, required user scopes, a customer-owned Lakebase Autoscaling database, optional SQL warehouse/AI endpoint, compute size, egress policy, and administrator grants. Provide a setup validation page that diagnoses each missing permission/resource.
3. Validate the provider listing workflow with Databricks, submit for the required security review, and test a consumer install in a clean workspace. Test upgrades against existing customer data and a rollback path; version package, API, schema, and export format together.
4. Confirm paid App listing and purchase mechanics with the Databricks partner team. Per D7, VDAB has no in-app license server, license key, or payment check. Do not infer a license from SSO or a purchaser's token; Marketplace publication remains blocked until the agreed commercial distribution path is confirmed.
5. Establish patch distribution, release notes, vulnerability response, and customer support diagnostics. A Marketplace update must not overwrite customer projects or child apps.

## Verification and exit criteria

- Test successful and denied create/link/deploy/redeploy flows with non-admin user roles; test partial failures, quota, and resource policy denial.
- Install and update the builder from the intended Marketplace channel in a separate customer-like workspace; build and run a child app there.
- Security review and commercial distribution route are documented and accepted by Databricks; any remaining external gate is marked as a release blocker, not assumed complete.
