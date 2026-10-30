# VDAB user guide

This guide covers using the standalone Node/React VDAB builder and deploying generated Python/Streamlit applications. Builder projects and deployment history persist in the installation’s Lakebase database.

## 1. Install VDAB in a Databricks workspace

Follow the complete [installation and verification guide](installation.md) in order. It specifies where to run every command and SQL query, machine prerequisites, generic and company-specific values, App creation, Lakebase schema grants, user scopes, browser consent, package upload, deployment, and acceptance checks.

Do not skip the separate checks for configured/effective App scopes and each user’s `user_consented_scopes`. If an App has `apps` configured but still cannot list Apps, begin with [consent and fresh-session verification](installation.md#8-verify-each-users-consent-and-start-a-fresh-app-session). The CLI and the browser use different tokens.

## 2. Update or redeploy VDAB

Use [the update sequence](installation.md#11-update-an-existing-installation), preserving the same App, stable source folder, and Lakebase binding. A source update deploys only `databricks-app/.build/`; it does not recreate the App or move its database. Users must grant new consent when the approved scope set changes.

See [deployment and operations](deployment-and-operations.md) for rollback, backups, recovery, and uninstall.

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
