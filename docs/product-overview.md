# Product overview

VDAB is installed as a Databricks App in one workspace. Workspace users use the builder to create projects, compose pages from registered components, configure workflows and modules, preview generated output, and deploy a child Databricks App that runs Python/Streamlit.

## Main capabilities

- Project creation, editing, archive/deletion, collaboration, and version conflict handling.
- A typed component catalog with standard controls, layout components, data components, visualizations, Databricks integrations, and eight story visualizations.
- Workflow definitions, custom Python modules, prebuilt modules, component bindings, and workspace resource references.
- AI Builder opened from the builder Prompt control on any section, backed by a ready chat model or AI Gateway endpoint the signed-in user can query. A proposal is applied to the open draft when that draft has not changed during generation.
- Immediate deploy from the builder or Apps list. Deploy saves the draft, uploads source under the project's workspace folder, starts the child App deployment, and opens that App page. Missing App name or workspace folder opens App Details instead.
- Workspace resource discovery and permission-aware operations using the current user's Databricks identity.
- In-browser preview, project export/import between standalone VDAB installations, and child-App create/link/deploy/retry/rollback flows.
- Durable project, access, deployment, and audit records in the Lakebase database bound to the builder App.

The component registry is a catalog, not persisted app state. A saved project stores its configured components and related project data. Resource references identify workspace assets; credentials and caller tokens are never project data. The exact tables and foreign-key relationships are in [the data model](data-model.md).

## Installation scope

Each installation is tied to its Databricks workspace and bound Lakebase resource. Projects, access grants, deployments, and audit history are scoped to that installation. A versioned project export can be imported into another installation; workspace resources must be selected again after import.

## Feature verification

Use the [deployment and operations guide](deployment-and-operations.md) for build, deployment, and runtime verification. Workspace resource permissions and OAuth consent are enforced through Databricks App identity and resource bindings.
