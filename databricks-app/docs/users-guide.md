# VDAB user guide

This guide takes you from the source repository to a running VDAB builder in a Databricks workspace, then through creating and deploying a generated Streamlit app.

VDAB itself is a Node.js Databricks App. The apps you create with it are separate Python/Streamlit Databricks Apps. Builder projects and deployment history are stored in the Lakebase database bound to VDAB.

## 1. Install VDAB in a Databricks workspace

### Prerequisites

- Node.js 22.16 or later and npm.
- The Databricks CLI installed and authenticated to the target workspace.
- A customer-owned Lakebase Autoscaling database for a first-time installation. The person adding the Lakebase resource needs permission to manage its Lakebase project.
- Permission to deploy the VDAB App and, later, permission to create or update child Apps.

Install VDAB once in each workspace where you want to use it. Choose a stable Databricks App name and workspace source folder for this installation. Keep using both when you update it.

### Prepare the workspace

1. Create or select a customer-owned Lakebase Autoscaling project, branch, and database for this VDAB installation.
2. In the Databricks workspace, create a custom App for VDAB. Record its App name; you will use it for deployment and updates.
3. In the App's **Resources** settings, add the Lakebase database with **Can connect and create** permission. Use the default resource key `postgres`; `app.yaml` reads the resource as `LAKEBASE_ENDPOINT`.
4. Configure the Apps API scopes approved for your workspace and the VDAB features you plan to use. The signed-in user's permissions and OAuth consent are checked when workspace features are used.

VDAB does not create Lakebase, SQL warehouses, model endpoints, Unity Catalog assets, Jobs, or child Apps for you. Each VDAB installation starts with a new, empty application schema in the bound Lakebase database.

### Authenticate the Databricks CLI

Check your CLI profiles and select the one for the intended workspace:

```sh
databricks auth profiles -o text
```

If needed, sign in to that workspace with `databricks auth login --host <workspace-url>` and choose a profile name. Use that profile explicitly in the commands below. See [Databricks CLI authentication](https://docs.databricks.com/aws/en/dev-tools/cli/authentication).

### Build and deploy the first version

From the repository root in a terminal using a POSIX-style shell (such as Bash, Git Bash, or WSL), install dependencies if this is the first build on this machine, then build and smoke-check the deployment package:

```sh
cd databricks-app
npm run install:all # first build on this machine only
npm run build
npm run smoke
cd ..
```

`npm run build` typechecks the server, runs its automated tests, builds the React client, and assembles the self-contained deployment package at `databricks-app/.build/`. `npm run smoke` checks that assembled package locally. The repository root and the legacy .NET projects are not the app source and must not be deployed.

This workflow deploys the generated package from a Databricks workspace folder. If the workspace enforces Git-only App deployments, ask its administrator for the approved way to build and deploy this repository's `.build` artifact; deploying the repository root directly does not include the required built client and runtime package.

Set the deployment values for your installation and sync the built package to a stable workspace folder. Replace the example values, then run:

```sh
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

After deployment succeeds, open the App and go to **Workspace setup**. Select **Check workspace setup** and resolve any Lakebase configuration or scope/consent issues with the workspace administrator. Create a small project, save it, reload it, and confirm it remains available. This checks that project state persists in the bound database.

Databricks Apps resource permissions and user OAuth scopes serve different purposes. VDAB uses the signed-in user's authorization for user-triggered workspace operations; a denied request is not retried with the builder App identity. Add only the scopes approved for the features you intend to use. See the [Databricks Lakebase App resource guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase) and VDAB's [identity and security guide](identity-and-security.md).

Do not use local-test authentication for a deployed App.

## 2. Update or redeploy VDAB

When the VDAB repository changes, rebuild the package and deploy it to the same App from the same workspace source folder. Do not create a new folder for each build; Databricks retains deployment snapshots for the App.

From the repository root:

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

Confirm the deployment succeeded and the App is running. You can also select the App in Databricks Apps, choose **Deploy**, and deploy from the same workspace source folder after syncing the new package. Open VDAB and check **Workspace setup** and the App logs if startup or resource access fails. Keep the same Lakebase binding during source updates so project data remains attached to this installation. A source rollback does not roll back database state; see [deployment and operations](deployment-and-operations.md) before recovering data or uninstalling.

### Verify and troubleshoot the builder deployment

- In the Databricks App details page, confirm deployment succeeded and the app is running. Open the app URL and inspect its logs if it does not start.
- On **Workspace setup**, check the installed workspace session, Lakebase inputs, default SQL warehouse configuration, and authorization scope/consent diagnostics.
- If Lakebase is incomplete, confirm the App has the intended `postgres` database resource and `Can connect and create` permission. Do not copy credentials into source or share them in logs.
- If a workspace resource picker is empty or an operation is denied, check the signed-in user's access and app-scope consent. An App resource binding by itself does not grant the user access to that resource.
- A successful local build or smoke run does not verify live Databricks permissions, resource bindings, or generated child-App execution.

## 3. Create a Databricks app with VDAB

The builder's **Apps** are saved VDAB projects. They are not Databricks Apps until you deploy one from the project editor.

### Create a project

1. Open VDAB and select **Apps** in the main navigation.
2. Select **Create New App** (or **Create Your First App** if the project list is empty).
3. Confirm the installed workspace. VDAB is pinned to this workspace; the wizard does not connect to another workspace.
4. Choose whether the project will create a new child Databricks App or link an existing App, then enter the VDAB project name and optional description and select or name the child App target.
5. VDAB creates the project in the Lakebase database bound to this installation and opens its editor with the chosen target preselected. The target choice is saved with the project and restored when you reopen it. The target is actually linked when you deploy from the project.
6. Use the editor navigation to move among **Canvas**, **Workflow**, **Code**, and **Settings**.

If this is the first time the workspace is being used, visit **Workspace setup** and run its diagnostic before configuring workspace-backed components. User consent and permission are checked when individual workspace features are used.

### Design the app

1. In **Canvas**, add controls, layout, data, chart, or story components from the component catalog. Select a component to edit its properties and data bindings.
2. Connect components to resources in the installed workspace using the available pickers. The signed-in user needs permission to discover and use the selected resource. Resource names and IDs identify workspace assets; do not enter credentials into project fields.
3. Open **Workflow** to define a workflow, its trigger, and actions such as SQL operations, Jobs, bindings, or custom/prebuilt modules. Configure only the actions the app needs and resolve validation messages as you go.
4. Open **Settings → App Details** to edit project metadata, the saved Databricks App target, and its **Workspace path**. Generated snapshots are placed under `<workspacePath>/.vdab/deployments/<projectId>/<attemptId>`; leaving the path blank uses your default VDAB folder. Use **App Theme** to adjust appearance and **Permissions** to manage project collaborators. Collaborator access does not grant Databricks permissions on its resources.
5. Optionally select **Prompt** to use AI Builder. Choose a ready chat endpoint with query access and function-calling support. Known embedding and completion endpoints are excluded. Review the proposed changes before applying and save the project afterward. Endpoint permissions and inference costs are controlled by the workspace.
6. Select **Save** after edits. Canvas Save persists component properties and their inline workflows together in version order, including workflows attached to newly added buttons. **Edit in Workflow Builder** opens the selected workflow action. Check for unsaved changes before leaving a section; deployment uses only the saved project version.

### Preview and inspect generated code

1. Open **Code** and request a generated code preview.
2. Review the preview errors and generated files. The output is Python/Streamlit source packaged for a Databricks App; the code preview helps inspect generation but does not run the child app in the workspace.
3. Return to **Canvas** or **Workflow** to correct configuration issues, save, and preview again.

### Deploy a child Databricks App

1. Save all project edits.
2. Select **Deploy** in the editor action bar, or open **Settings → Resources**.
3. Review the deployment readiness section. It lists the user API scopes and child-App resources required by the saved project. Resolve any blockers before deploying.
4. Choose **Create a new App** and enter a unique workspace App name (2–30 lowercase letters, numbers, or hyphens), or choose **Link an existing App** and select an App you are allowed to update. The create/link choice from the project wizard is preselected here.
5. Review the target App and required resources. If linking an existing App, enable the explicit confirmation that its current source will be replaced.
6. Add any required workspace secret-resource bindings if the project needs them. Secret values are managed in Databricks and are not stored in the VDAB project.
7. Select **Create and deploy App** or **Link and deploy App**. Wait for the deployment attempt to appear in the project deployment history, then select **Open app** in the toolbar to run it. The Apps dashboard reports the child App's current status; its **Open** action launches the runtime, **Edit** opens the builder, and **Deploy** opens deployment settings.

Databricks checks your own permissions for App creation, source upload, and resources. For App Spaces, workspace policy may also require `CAN CREATE APP`. The child App has its own App identity, resource bindings, source access, and lifecycle. Generated code never receives the VDAB builder's Lakebase credentials, forwarded user token, or App privileges.

### Manage child-App resource grants

After a child App is linked to a project, open **Settings → Resources → App resource grants** to review the grants given to that App's service principal. Required grants derived from current project bindings are marked and protected. Add, remove, or change supported secret grants and change non-required SQL warehouse grants, then select **Save resource grants**. Databricks verifies the acting user's Apps scope and resource-management permissions. If the App has a resource type VDAB cannot safely preserve, VDAB blocks the update so you can review its complete resource list in Databricks first.

### Update, retry, or restore a child App

- Edit and save the VDAB project, then select **Deploy saved version** for its linked child App. Confirm the target carefully because deployment replaces the child App's generated source.
- Check **Deployment history** for status and error details. Use the available retry action for failed deployments after resolving the cause.
- Use the project deployment restore action to redeploy the last successful saved snapshot after a failed or cancelled update.
- To manage the child App outside VDAB, use Databricks Apps in the workspace. Builder source updates and child-App deployment histories are separate operations.

## 4. Share or move a project

- Use **Settings → Permissions** to grant collaborators access to a project in this VDAB installation. They still need their own Databricks resource permissions and scopes.
- Use **Apps → Import a standalone project** to import a `.vdab.json` project bundle from another standalone VDAB installation. Re-select or rebind workspace resources after import; the export does not carry credentials or grant permissions.
- Use project export for portability. Use the Lakebase backup/PITR process for recovery of the installation's project data. See [deployment and operations](deployment-and-operations.md).

## More detail

- [Product overview](product-overview.md)
- [Browser application](browser-application.md)
- [Generated Streamlit applications](generated-applications.md)
- [Identity and security](identity-and-security.md)
- [HTTP API reference](api-reference.md)
