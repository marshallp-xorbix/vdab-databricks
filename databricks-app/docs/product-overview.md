# Product overview

VDAB is installed as a Databricks App in one workspace. Workspace users use the builder to create projects, compose pages from registered components, configure workflows and modules, preview generated output, and deploy a child Databricks App that runs Python/Streamlit.

## Main capabilities

- Project creation, editing, archive/deletion, collaboration, and version conflict handling.
- A typed component catalog with standard controls, layout components, data components, visualizations, Databricks integrations, and eight story visualizations.
- Workflow definitions, custom Python modules, prebuilt modules, component bindings, and workspace resource references.
- AI Builder backed by model or AI Gateway endpoints configured in the installed workspace.
- Workspace resource discovery and permission-aware operations using the current user's Databricks identity.
- In-browser preview, project export/import between standalone VDAB installations, and child-App create/link/deploy/retry/rollback flows.
- Durable project, access, deployment, and audit records in the Lakebase database bound to the builder App.

The component registry is a catalog, not persisted app state. A saved project stores its configured components and related project data. Resource references identify workspace assets; credentials and caller tokens are never project data. The exact tables and foreign-key relationships are in [the data model](data-model.md).

## Product boundary

An installation is tied to its current workspace and its bound Lakebase resource. It does not provide SaaS tenant management, subscriptions, billing, cross-workspace connections, or SaaS project migration. Each installation starts with an empty VDAB schema. Standalone project export/import is a separate, versioned format and intentionally requires workspace resources to be selected again.

## Feature verification

Use the [deployment and operations guide](deployment-and-operations.md) for build, deployment, and runtime verification. Workspace resource permissions and OAuth consent are enforced through Databricks App identity and resource bindings.
