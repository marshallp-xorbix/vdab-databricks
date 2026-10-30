# Lakebase data model

VDAB stores durable state in the customer-owned Lakebase database bound to the builder App. The append-only PostgreSQL schema begins at `server/src/db/migrations/001_initial_schema.sql` and is managed by the migration runner in `server/src/db/migrations.ts`.

## Tables and relationships

| Table | Purpose | Relationship |
| --- | --- | --- |
| `vdab_projects` | Project identity, workspace-local visibility, owner, version, timestamps, soft deletion | Root record |
| `vdab_project_collaborators` | Explicit editor/viewer grants | Many records per project; cascade delete |
| `vdab_project_components` | Configured component type/version, tree position, parent, properties, and bindings | Many records per project; stable component keys; parent is another row in the same project |
| `vdab_project_workflows` | Workflow definitions | Many records per project |
| `vdab_project_custom_modules` | User-authored module source and version | Many records per project |
| `vdab_project_resource_references` | Display metadata and optional current-workspace resource binding | Many records per project; no stored credential |
| `vdab_project_child_apps` | Linked or created Databricks child App | At most one current target per project |
| `vdab_project_deployments` | Deployment attempts, source version/snapshot, actor, and outcome | Many records per project |
| `vdab_audit_events` | Actor/action/outcome history | Optional project reference; workspace-scoped |
| `vdab_instance_settings` | Installation-local setting values | Keyed by setting name |

The project is the aggregate root. Components, workflows, modules, and resource references are project-owned records and are replaced/updated through project-scoped APIs with optimistic version checks. The component registry itself is stateless definition data and is not copied into every project.

## Relationship to the former SaaS model

The former builder persisted one `App` record and related `AppComponent` records. The standalone model keeps that same logical structure: one `vdab_projects` record with separately keyed `vdab_project_components` records. It is not a component catalog copied per app; rows are only the components the user placed in that particular app.

| Former SaaS field | Standalone field or record | Notes |
| --- | --- | --- |
| `App.AppName`, `Description` | `vdab_projects.name`, `description` | Project is the standalone name for the app aggregate. |
| `App.OwnerId` | `vdab_projects.created_by` | Databricks user identifier replaces SaaS account identity. |
| `App.Version` | `vdab_projects.version` | Optimistic concurrency for project aggregate writes. |
| `App.Theme` | `vdab_projects.theme` JSONB | Retains per-app theme. |
| `App.WorkspacePath`, Databricks target choice | `vdab_projects.deployment_settings` JSONB | Saves the install-local App name/mode and optional source parent folder. Generated attempts remain isolated beneath that folder; portable exports require target reselection. |
| `App.WorkflowDefinition` | `vdab_project_workflows` | Workflow definitions remain project-owned and have stable keys/order. |
| `App.CustomModulesCode` | `vdab_project_custom_modules` | Module source remains project-owned and versioned. |
| `AppComponent.CodeName`, `Description` | `vdab_project_components.code_name`, `description` | Preserves user naming/description. |
| `AppComponent.ComponentType`, `ComponentVersion` | `component_type`, `component_version` | Retains the selected definition and its saved version. |
| `AppComponent.Properties`, `Bindings` | `properties`, `bindings` JSONB | Preserves configured component state and resource-key bindings. |
| `AppComponent.Children`, `Layout` | `children`, `layout` JSONB; `parent_key`, `sort_order` | Preserves child membership and layout while adding stable ordering/tree constraints. |
| App publish metadata | `vdab_project_deployments` | Deployment attempts and source snapshots replace a single last-published timestamp with recoverable history. |

SaaS tenant/subscription columns, external workspace connection IDs, cross-workspace paths, and stored OAuth/PAT credentials are intentionally absent. `workspace_id` identifies the single trusted workspace hosting the installation; it is not a connection selector. The standalone model adds collaborators, workspace resource references, child-App linkage, deployment history, and audit events for the new product's lifecycle.

`workspace_id` is the trusted installed workspace identifier used to scope records and indexes. It is not a user-selected connection and is not a tenant database. SaaS tenant IDs, external workspace connection IDs, PATs, OAuth tokens, passwords, and generated credentials are not part of the standalone schema.

## Consistency and changes

- Project writes use a project version and reject stale updates rather than silently overwriting concurrent changes.
- Deleting a project cascades to its project-owned records. Audit history uses `ON DELETE SET NULL` so events can remain without retaining a deleted project row.
- Deployment source snapshots are immutable records used by retry/recovery flows; they are not the live project document.
- Add schema changes as new append-only migrations. Test migrations against disposable PostgreSQL before workspace use; never edit an applied migration or run an unreviewed migration against shared Lakebase.
- Project export is a standalone portability format, not a database backup. It omits credentials and requires resource reselection after import.
