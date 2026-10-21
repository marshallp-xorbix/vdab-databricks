import { ApplicationError } from "../application-error.ts";
import type { ProjectActor } from "./project-repository.ts";
import { insertAuditEvent } from "./project-repository.ts";
import type { SqlPool } from "./sql.ts";
import type {
  ProjectWorkflow,
  ProjectWorkflowDefinition,
  ProjectWorkflowDocument,
} from "./project-workflow-contract.ts";
import { readProjectWorkflowInput, readStoredWorkflow } from "./project-workflow-input.ts";

/** Persistence boundary for ordered workflow definitions owned by one project. */
export interface ProjectWorkflowRepository {
  /** Reads workflows only when the caller may access the project. */
  getWorkflow(projectId: string, actor: ProjectActor): Promise<ProjectWorkflowDocument | null>;
  /** Atomically replaces workflows and advances the shared project version. */
  replaceWorkflow(
    projectId: string,
    expectedVersion: number,
    workflow: ProjectWorkflowDefinition,
    actor: ProjectActor,
  ): Promise<ProjectWorkflowDocument | null>;
}

interface WorkflowRow extends Record<string, unknown> {
  version: number;
  created_by: string;
  workflow_key: string | null;
  definition: unknown;
  sort_order: number | null;
}

interface ProjectVersionRow extends Record<string, unknown> {
  version: number;
  created_by: string;
}

/** PostgreSQL implementation with ACL-scoped reads and atomic versioned saves. */
export class PostgresProjectWorkflowRepository implements ProjectWorkflowRepository {
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async getWorkflow(projectId: string, actor: ProjectActor): Promise<ProjectWorkflowDocument | null> {
    const result = await this.pool.query<WorkflowRow>(
      `SELECT p.version, p.created_by, w.workflow_key, w.definition, w.sort_order
       FROM vdab_projects p
       LEFT JOIN vdab_project_collaborators acl
         ON acl.project_id = p.id AND acl.user_id = $3
       LEFT JOIN vdab_project_workflows w ON w.project_id = p.id
       WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
         AND (p.created_by = $3 OR acl.user_id IS NOT NULL OR $4)
       ORDER BY w.sort_order, w.workflow_key`,
      [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
    );
    const project = result.rows[0];

    if (!project) return null;

    const workflows = result.rows
      .filter((row) => row.workflow_key !== null)
      .map(toProjectWorkflow);
    const workflow = readProjectWorkflowInput({
      version: Number(project.version),
      workflow: { version: 1, workflows },
    }).workflow;

    if (actor.isInstallationAdmin && project.created_by !== actor.userId) {
      await insertAuditEvent(this.pool, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.workflow.read.recovery",
        requestId: actor.requestId,
      });
    }

    return { projectId, version: Number(project.version), workflow };
  }

  async replaceWorkflow(
    projectId: string,
    expectedVersion: number,
    workflow: ProjectWorkflowDefinition,
    actor: ProjectActor,
  ): Promise<ProjectWorkflowDocument | null> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const projectResult = await client.query<ProjectVersionRow>(
        `SELECT p.version, p.created_by
         FROM vdab_projects p
         LEFT JOIN vdab_project_collaborators c
           ON c.project_id = p.id AND c.user_id = $3
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
           AND (p.created_by = $3 OR (c.user_id = $3 AND c.role = 'editor') OR $4)
         LIMIT 1 FOR UPDATE OF p`,
        [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
      );
      const project = projectResult.rows[0];

      if (!project) {
        await client.query("ROLLBACK");
        return null;
      }

      if (Number(project.version) !== expectedVersion) throw projectVersionConflict();

      await client.query("DELETE FROM vdab_project_workflows WHERE project_id = $1", [projectId]);
      for (const [sortOrder, definition] of workflow.workflows.entries()) {
        await client.query(
          `INSERT INTO vdab_project_workflows
             (project_id, workflow_key, definition, sort_order)
           VALUES ($1, $2, $3::jsonb, $4)`,
          [projectId, definition.codeName, JSON.stringify(definition), sortOrder],
        );
      }

      const updatedProject = await client.query<{ version: number }>(
        `UPDATE vdab_projects AS p
         SET version = p.version + 1, updated_at = now()
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.version = $3
           AND p.deleted_at IS NULL
           AND (p.created_by = $4 OR EXISTS (
             SELECT 1 FROM vdab_project_collaborators AS c
             WHERE c.project_id = p.id AND c.user_id = $4 AND c.role = 'editor'
           ) OR $5)
         RETURNING p.version`,
        [projectId, actor.workspaceId, expectedVersion, actor.userId, actor.isInstallationAdmin],
      );
      const savedProject = updatedProject.rows[0];

      if (!savedProject) throw projectVersionConflict();

      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action:
          actor.isInstallationAdmin && project.created_by !== actor.userId
            ? "project.workflow.replace.recovery"
            : "project.workflow.replace",
        requestId: actor.requestId,
        metadata: {
          previousVersion: expectedVersion,
          version: Number(savedProject.version),
          workflowCount: workflow.workflows.length,
        },
      });
      await client.query("COMMIT");

      return { projectId, version: Number(savedProject.version), workflow };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

function toProjectWorkflow(row: WorkflowRow): ProjectWorkflow {
  const parsed = typeof row.definition === "string" ? parseJson(row.definition) : row.definition;
  const workflow = readStoredWorkflow(parsed);

  if (workflow.codeName !== row.workflow_key) {
    throw new Error("Stored workflow key does not match its definition.");
  }

  return workflow;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("Stored workflow JSON is invalid.");
  }
}

async function rollback(client: { query(text: string): Promise<unknown> }): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original failure if PostgreSQL has closed the transaction.
  }
}

function projectVersionConflict(): ApplicationError {
  return new ApplicationError(409, "project_version_conflict", "Project changed", "This project was updated by another user. Reload it before saving again.");
}
