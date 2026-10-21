import { ApplicationError } from "../application-error.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
  ProjectJsonObject,
} from "./project-components-contract.ts";
import { insertAuditEvent } from "./project-repository.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { SqlPool } from "./sql.ts";

/** Persistence boundary for the versioned component collection of one project. */
export interface ProjectComponentsRepository {
  /** Reads components only when the caller may read the project. */
  getComponents(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument | null>;
  /** Atomically replaces components and advances the project version. */
  replaceComponents(
    projectId: string,
    expectedVersion: number,
    components: ProjectComponent[],
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument | null>;
}

interface ProjectVersionRow extends Record<string, unknown> {
  version: number;
  created_by: string;
}

interface ProjectComponentRow extends Record<string, unknown> {
  version: number;
  created_by: string;
  component_key: string | null;
  component_type: ProjectComponent["type"] | null;
  schema_version: number | null;
  component_version: number | null;
  sort_order: number | null;
  code_name: string | null;
  description: string | null;
  properties: unknown;
  bindings: unknown;
  children: unknown;
  layout: unknown;
}

/** PostgreSQL implementation with ACL-scoped reads and atomic optimistic saves. */
export class PostgresProjectComponentsRepository
  implements ProjectComponentsRepository
{
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async getComponents(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument | null> {
    const projectResult = await this.pool.query<ProjectComponentRow>(
      `SELECT p.version, p.created_by,
              pc.component_key, pc.component_type, pc.schema_version,
              pc.component_version, pc.sort_order, pc.code_name,
              pc.description, pc.properties, pc.bindings, pc.children, pc.layout
       FROM vdab_projects p
       LEFT JOIN vdab_project_collaborators acl
         ON acl.project_id = p.id AND acl.user_id = $3
       LEFT JOIN vdab_project_components pc ON pc.project_id = p.id
       WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
         AND (p.created_by = $3 OR acl.user_id IS NOT NULL OR $4)
       ORDER BY pc.sort_order, pc.component_key`,
      [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
    );
    const projectRows = projectResult.rows;
    const project = projectRows[0];

    if (!project) {
      return null;
    }

    if (actor.isInstallationAdmin && project.created_by !== actor.userId) {
      await insertAuditEvent(this.pool, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.components.read.recovery",
        requestId: actor.requestId,
      });
    }

    return {
      projectId,
      version: Number(project.version),
      components: projectRows
        .filter((row) => row.component_key !== null)
        .map(toProjectComponent),
    };
  }

  async replaceComponents(
    projectId: string,
    expectedVersion: number,
    components: ProjectComponent[],
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument | null> {
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
         LIMIT 1
         FOR UPDATE OF p`,
        [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
      );
      const project = projectResult.rows[0];

      if (!project) {
        await client.query("ROLLBACK");
        return null;
      }

      if (Number(project.version) !== expectedVersion) {
        throw projectVersionConflict();
      }

      await client.query(
        "DELETE FROM vdab_project_components WHERE project_id = $1",
        [projectId],
      );
      const parentByChild = getParentByChild(components);

      for (const [sortOrder, component] of components.entries()) {
        await client.query(
          `INSERT INTO vdab_project_components
             (project_id, component_key, component_type, schema_version,
              component_version, sort_order, parent_key, code_name, description,
              properties, bindings, children, layout)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                   $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)`,
          [
            projectId,
            component.key,
            component.type,
            component.schemaVersion,
            component.componentVersion,
            sortOrder,
            parentByChild.get(component.key) ?? null,
            component.codeName,
            component.description,
            JSON.stringify(component.properties),
            component.bindings === null ? null : JSON.stringify(component.bindings),
            JSON.stringify(component.children),
            component.layout === null ? null : JSON.stringify(component.layout),
          ],
        );
      }

      const updateResult = await client.query<{ version: number }>(
        `UPDATE vdab_projects AS p
         SET version = p.version + 1, updated_at = now()
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.version = $3
           AND p.deleted_at IS NULL
           AND (p.created_by = $4 OR EXISTS (
             SELECT 1 FROM vdab_project_collaborators AS c
             WHERE c.project_id = p.id AND c.user_id = $4 AND c.role = 'editor'
           ) OR $5)
         RETURNING p.version`,
        [
          projectId,
          actor.workspaceId,
          expectedVersion,
          actor.userId,
          actor.isInstallationAdmin,
        ],
      );
      const updatedProject = updateResult.rows[0];

      if (!updatedProject) {
        throw projectVersionConflict();
      }

      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action:
          actor.isInstallationAdmin && project.created_by !== actor.userId
            ? "project.components.replace.recovery"
            : "project.components.replace",
        requestId: actor.requestId,
        metadata: {
          previousVersion: expectedVersion,
          version: Number(updatedProject.version),
          componentCount: components.length,
        },
      });
      await client.query("COMMIT");

      return {
        projectId,
        version: Number(updatedProject.version),
        components,
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

function toProjectComponent(row: ProjectComponentRow): ProjectComponent {
  if (
    row.component_key === null ||
    row.component_type === null ||
    row.schema_version === null ||
    row.component_version === null
  ) {
    throw new Error("Stored project component identity is invalid.");
  }

  return {
    key: row.component_key,
    type: row.component_type,
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

function readJsonObject(value: unknown): ProjectJsonObject {
  const parsedValue = typeof value === "string" ? parseJson(value) : value;

  if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
    throw new Error("Stored project component object is invalid.");
  }

  return parsedValue as ProjectJsonObject;
}

function readJsonArray(value: unknown): string[] {
  const parsedValue = typeof value === "string" ? parseJson(value) : value;

  if (
    !Array.isArray(parsedValue) ||
    parsedValue.some((childKey) => typeof childKey !== "string")
  ) {
    throw new Error("Stored project component child list is invalid.");
  }

  return parsedValue;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("Stored project component JSON is invalid.");
  }
}

function getParentByChild(components: ProjectComponent[]): Map<string, string> {
  const parentByChild = new Map<string, string>();

  for (const component of components) {
    for (const childKey of component.children) {
      parentByChild.set(childKey, component.key);
    }
  }

  return parentByChild;
}

async function rollback(client: {
  query(text: string): Promise<unknown>;
}): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the repository failure if PostgreSQL already closed the transaction.
  }
}

function projectVersionConflict(): ApplicationError {
  return new ApplicationError(
    409,
    "project_version_conflict",
    "Project changed",
    "This project was updated by another user. Reload it before saving again.",
  );
}
