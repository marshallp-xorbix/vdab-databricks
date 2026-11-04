import { randomUUID } from "node:crypto";
import type { ProjectSummary } from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "./project-custom-modules-contract.ts";
import type { ProjectComponent, ProjectJsonObject } from "./project-components-contract.ts";
import type { ImportedProjectAggregate, PortableResourceKind, ProjectAggregateSnapshot } from "./project-portability-contract.ts";
import type { ProjectActor } from "./project-repository.ts";
import { insertAuditEvent } from "./project-repository.ts";
import type { ProjectWorkflow } from "./project-workflow-contract.ts";
import type { SqlClient, SqlPool } from "./sql.ts";

/** ACL-scoped project archive boundary with one-snapshot reads and atomic imports. */
export interface ProjectPortabilityRepository {
  getProjectAggregate(projectId: string, actor: ProjectActor): Promise<ProjectAggregateSnapshot | null>;
  importProjectAggregate(aggregate: ImportedProjectAggregate, actor: ProjectActor): Promise<ProjectSummary>;
}

interface SnapshotProjectRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  version: number;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  theme: unknown;
  caller_role: ProjectSummary["callerRole"];
  child_app_name: string | null;
}

interface ComponentRow extends Record<string, unknown> {
  component_key: string;
  component_type: string;
  schema_version: number;
  component_version: number;
  code_name: string | null;
  description: string | null;
  properties: unknown;
  bindings: unknown;
  children: unknown;
  layout: unknown;
}

interface WorkflowRow extends Record<string, unknown> {
  workflow_key: string;
  definition: unknown;
}

interface ResourceReferenceRow extends Record<string, unknown> {
  resource_key: string;
  resource_type: PortableResourceKind;
  display_name: string;
  metadata: unknown;
}

interface CreatedProjectRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  version: number;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
}

/** PostgreSQL implementation for portable snapshots and transactional imports. */
export class PostgresProjectPortabilityRepository implements ProjectPortabilityRepository {
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async getProjectAggregate(projectId: string, actor: ProjectActor): Promise<ProjectAggregateSnapshot | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const projectResult = await client.query<SnapshotProjectRow>(
        `SELECT p.id, p.name, p.description, p.version, p.created_by,
                p.created_at, p.updated_at, p.theme,
                CASE WHEN p.created_by = $3 THEN 'owner'
                     WHEN $4 THEN 'installationAdmin'
                     WHEN c.user_id = $3 THEN c.role ELSE 'viewer' END AS caller_role,
                child.app_name AS child_app_name
         FROM vdab_projects p
         LEFT JOIN vdab_project_collaborators c
           ON c.project_id = p.id AND c.user_id = $3
         LEFT JOIN vdab_project_child_apps child ON child.project_id = p.id
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
           AND (p.created_by = $3 OR c.user_id IS NOT NULL OR $4)
         LIMIT 1`,
        [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
      );
      const row = projectResult.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }

      const componentResult = await client.query<ComponentRow>(
          `SELECT component_key, component_type, schema_version, component_version,
                  code_name, description, properties, bindings, children, layout
           FROM vdab_project_components WHERE project_id = $1 ORDER BY sort_order, component_key`,
          [projectId],
        );
      const workflowResult = await client.query<WorkflowRow>(
          `SELECT workflow_key, definition FROM vdab_project_workflows
           WHERE project_id = $1 ORDER BY sort_order, workflow_key`,
          [projectId],
        );
      const moduleResult = await client.query<{ source_text: string }>(
          `SELECT source_text FROM vdab_project_custom_modules
           WHERE project_id = $1 AND module_key = 'custom'`,
          [projectId],
        );
      const referenceResult = await client.query<ResourceReferenceRow>(
          `SELECT resource_key, resource_type, display_name, metadata FROM vdab_project_resource_references
           WHERE project_id = $1 ORDER BY resource_key`,
          [projectId],
        );

      if (actor.isInstallationAdmin && row.created_by !== actor.userId) {
        await insertAuditEvent(client, {
          workspaceId: actor.workspaceId,
          projectId,
          actorId: actor.userId,
          action: "project.export.recovery",
          requestId: actor.requestId,
        });
      }
      await client.query("COMMIT");
      return {
        project: toProjectSummary(row, row.caller_role),
        theme: readNullableJsonObject(row.theme),
        components: componentResult.rows.map(toProjectComponent),
        workflow: {
          version: 1,
          workflows: workflowResult.rows.map((workflow) => readWorkflow(workflow.definition)),
        },
        customModulesSource: moduleResult.rows[0]?.source_text ?? DEFAULT_CUSTOM_MODULES_SOURCE,
        resourceReferences: referenceResult.rows.map(toPortableResourceReference),
        childAppDisplayName: row.child_app_name,
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async importProjectAggregate(aggregate: ImportedProjectAggregate, actor: ProjectActor): Promise<ProjectSummary> {
    const projectId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<CreatedProjectRow>(
        `INSERT INTO vdab_projects (id, workspace_id, name, description, created_by, theme)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id, name, description, version, created_by, created_at, updated_at`,
        [projectId, actor.workspaceId, aggregate.name, aggregate.description, actor.userId, JSON.stringify(aggregate.theme)],
      );
      const project = inserted.rows[0];
      if (!project) throw new Error("PostgreSQL did not return the imported project.");

      const parentByChild = getParentByChild(aggregate.components);
      for (const [sortOrder, component] of aggregate.components.entries()) {
        await client.query(
          `INSERT INTO vdab_project_components
             (project_id, component_key, component_type, schema_version, component_version,
              sort_order, parent_key, code_name, description, properties, bindings, children, layout)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)`,
          [projectId, component.key, component.type, component.schemaVersion, component.componentVersion,
            sortOrder, parentByChild.get(component.key) ?? null, component.codeName, component.description,
            JSON.stringify(component.properties), component.bindings === null ? null : JSON.stringify(component.bindings),
            JSON.stringify(component.children), JSON.stringify(component.layout)],
        );
      }

      for (const [sortOrder, workflow] of aggregate.workflow.workflows.entries()) {
        await client.query(
          `INSERT INTO vdab_project_workflows (project_id, workflow_key, definition, sort_order)
           VALUES ($1, $2, $3::jsonb, $4)`,
          [projectId, workflow.codeName, JSON.stringify(workflow), sortOrder],
        );
      }
      await client.query(
        `INSERT INTO vdab_project_custom_modules
           (project_id, module_key, display_name, source_text, schema_version)
         VALUES ($1, 'custom', 'Custom modules', $2, 1)`,
        [projectId, aggregate.customModulesSource],
      );
      for (const reference of aggregate.resourceReferences) {
        await client.query(
          `INSERT INTO vdab_project_resource_references
             (project_id, resource_key, resource_type, display_name, workspace_resource_id, resolved, metadata)
           VALUES ($1, $2, $3, $4, NULL, false, $5::jsonb)`,
          [projectId, reference.key, reference.kind, reference.label, JSON.stringify({
            componentKeys: reference.componentKeys,
            workflowNodeIds: reference.workflowNodeIds,
          })],
        );
      }
      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.import",
        requestId: actor.requestId,
        metadata: {
          schemaVersion: 1,
          componentCount: aggregate.components.length,
          workflowCount: aggregate.workflow.workflows.length,
          unresolvedResourceCount: aggregate.resourceReferences.length,
        },
      });
      await client.query("COMMIT");
      return toProjectSummary(project, "owner");
    } catch (error) {
      await rollback(client);
      if (isProjectNameConflict(error)) {
        throw new ApplicationError(409, "project_name_conflict", "Project name already exists", "Choose another project name in this workspace.");
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function toProjectComponent(row: ComponentRow): ProjectComponent {
  return {
    key: row.component_key,
    type: row.component_type as ProjectComponent["type"],
    schemaVersion: Number(row.schema_version),
    componentVersion: Number(row.component_version),
    codeName: row.code_name,
    description: row.description,
    properties: readJsonObject(row.properties),
    bindings: row.bindings === null ? null : readJsonObject(row.bindings),
    children: readJsonArray(row.children),
    layout: row.layout === null ? null : readJsonObject(row.layout),
  };
}

function readWorkflow(value: unknown): ProjectWorkflow {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Stored project workflow is invalid.");
  }
  return parsed as ProjectWorkflow;
}

function readNullableJsonObject(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  return readJsonObject(value);
}

function toPortableResourceReference(row: ResourceReferenceRow): ProjectAggregateSnapshot["resourceReferences"][number] {
  const metadata = readJsonObject(row.metadata);
  const componentKeys = readOptionalStringArray(metadata.componentKeys);
  const workflowNodeIds = readOptionalStringArray(metadata.workflowNodeIds);
  return {
    key: row.resource_key,
    kind: row.resource_type,
    label: row.display_name,
    ...(componentKeys === undefined ? {} : { componentKeys }),
    ...(workflowNodeIds === undefined ? {} : { workflowNodeIds }),
  };
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Stored portable resource usage is invalid.");
  }
  return value;
}

function readJsonObject(value: unknown): ProjectJsonObject {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Stored project JSON object is invalid.");
  return parsed as ProjectJsonObject;
}

function readJsonArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(parsed) || parsed.some((child) => typeof child !== "string")) throw new Error("Stored project child references are invalid.");
  return parsed;
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value) as unknown; }
  catch { throw new Error("Stored project JSON is invalid."); }
}

function getParentByChild(components: ProjectComponent[]): Map<string, string> {
  const parentByChild = new Map<string, string>();
  for (const component of components) for (const childKey of component.children) parentByChild.set(childKey, component.key);
  return parentByChild;
}

function toProjectSummary(row: CreatedProjectRow | SnapshotProjectRow, callerRole: ProjectSummary["callerRole"]): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: Number(row.version),
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    callerRole,
  };
}

function toIsoString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("PostgreSQL returned an invalid project timestamp.");
  return date.toISOString();
}

function isProjectNameConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505" && databaseError.constraint === "ux_vdab_projects_workspace_name";
}

async function rollback(client: SqlClient): Promise<void> {
  try { await client.query("ROLLBACK"); }
  catch { /* Keep the original failure when PostgreSQL has already closed the transaction. */ }
}
