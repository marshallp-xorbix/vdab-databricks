# Lakebase data model

VDAB stores durable state in the Lakebase database bound to the builder App. The append-only PostgreSQL schema begins at `server/src/db/migrations/001_initial_schema.sql` and is managed by the migration runner in `server/src/db/migrations.ts`.

## Tables and relationships

| Table | Purpose | Relationship |
| --- | --- | --- |
| `vdab_projects` | Project identity, workspace-local visibility, owner, version, timestamps, and soft deletion | Root record |
| `vdab_project_collaborators` | Explicit editor/viewer grants | Many records per project; cascade delete |
| `vdab_project_components` | Configured component type/version, tree position, parent, properties, and bindings | Many records per project; stable component keys; parent is another row in the same project |
| `vdab_project_workflows` | Workflow definitions | Many records per project |
| `vdab_project_custom_modules` | User-authored module source and version | Many records per project |
| `vdab_project_resource_references` | Display metadata and optional current-workspace resource binding | Many records per project; no stored credential |
| `vdab_project_child_apps` | Linked or created Databricks child App | At most one current target per project |
| `vdab_project_deployments` | Deployment attempts, source version/snapshot, actor, and outcome | Many records per project |
| `vdab_audit_events` | Actor/action/outcome history | Optional project reference; workspace-scoped |
| `vdab_instance_settings` | Installation-local setting values | Keyed by setting name |

The project is the aggregate root. Components, workflows, modules, and resource references are project-owned records updated through project-scoped APIs with optimistic version checks. Component definitions are stateless registry data and are not copied into projects.

`workspace_id` is the trusted workspace identifier used to scope project records and indexes. Resource references contain only the information required to select workspace assets. Caller tokens, credentials, and generated secrets are never stored in project data.

## Consistency and changes

- Project writes use a project version and reject stale updates rather than silently overwriting concurrent changes.
- Deleting a project cascades to project-owned records. Audit history uses `ON DELETE SET NULL` so events can remain without retaining a deleted project row.
- Deployment source snapshots are immutable records used by retry and recovery flows; they are not the live project document.
- Add schema changes as new append-only migrations. Test migrations against disposable PostgreSQL before workspace use; never edit an applied migration or run an unreviewed migration against shared Lakebase.
- Project export is a versioned portability format, not a database backup. It omits credentials and requires resource reselection after import.
