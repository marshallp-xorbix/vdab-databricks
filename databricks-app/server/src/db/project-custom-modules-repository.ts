import { ApplicationError } from "../application-error.ts";
import type { ProjectActor } from "./project-repository.ts";
import { insertAuditEvent } from "./project-repository.ts";
import type { SqlPool } from "./sql.ts";
import {
  DEFAULT_CUSTOM_MODULES_SOURCE,
  type ProjectCustomModulesDocument,
} from "./project-custom-modules-contract.ts";

/** Persistence boundary for the project's editable custom Python module. */
export interface ProjectCustomModulesRepository {
  /** Reads source only when the actor may access the project. */
  getCustomModules(projectId: string, actor: ProjectActor): Promise<ProjectCustomModulesDocument | null>;
  /** Saves source and advances the shared project version atomically. */
  replaceCustomModules(
    projectId: string,
    expectedVersion: number,
    source: string,
    actor: ProjectActor,
  ): Promise<ProjectCustomModulesDocument | null>;
}

interface CustomModulesRow extends Record<string, unknown> {
  version: number;
  created_by: string;
  source_text: string | null;
}

interface ProjectVersionRow extends Record<string, unknown> {
  version: number;
  created_by: string;
  collaborator_role: string | null;
}

/** PostgreSQL repository using the custom-module table already in schema v1. */
export class PostgresProjectCustomModulesRepository implements ProjectCustomModulesRepository {
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async getCustomModules(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCustomModulesDocument | null> {
    const result = await this.pool.query<CustomModulesRow>(
      `SELECT p.version, p.created_by, m.source_text
       FROM vdab_projects p
       LEFT JOIN vdab_project_collaborators acl
         ON acl.project_id = p.id AND acl.user_id = $3
       LEFT JOIN vdab_project_custom_modules m
         ON m.project_id = p.id AND m.module_key = 'custom'
       WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
         AND (p.created_by = $3 OR acl.user_id IS NOT NULL OR $4)`,
      [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
    );
    const project = result.rows[0];
    if (!project) return null;

    if (actor.isInstallationAdmin && project.created_by !== actor.userId) {
      await insertAuditEvent(this.pool, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.custom_modules.read.recovery",
        requestId: actor.requestId,
      });
    }

    return {
      projectId,
      version: Number(project.version),
      source: project.source_text ?? DEFAULT_CUSTOM_MODULES_SOURCE,
    };
  }

  async replaceCustomModules(
    projectId: string,
    expectedVersion: number,
    source: string,
    actor: ProjectActor,
  ): Promise<ProjectCustomModulesDocument | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const projectResult = await client.query<ProjectVersionRow>(
        `SELECT p.version, p.created_by, c.role AS collaborator_role
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

      await client.query(
        `INSERT INTO vdab_project_custom_modules
           (project_id, module_key, display_name, source_text, schema_version, updated_at)
         VALUES ($1, 'custom', 'Custom modules', $2, 1, now())
         ON CONFLICT (project_id, module_key) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             source_text = EXCLUDED.source_text,
             schema_version = EXCLUDED.schema_version,
             updated_at = now()`,
        [projectId, source],
      );
      const updated = await client.query<{ version: number }>(
        `UPDATE vdab_projects AS p
         SET version = p.version + 1, updated_at = now()
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.version = $3
           AND p.deleted_at IS NULL
         RETURNING p.version`,
        [projectId, actor.workspaceId, expectedVersion],
      );
      const saved = updated.rows[0];
      if (!saved) throw projectVersionConflict();

      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action:
          actor.isInstallationAdmin && project.created_by !== actor.userId
            ? "project.custom_modules.replace.recovery"
            : "project.custom_modules.replace",
        requestId: actor.requestId,
        metadata: { previousVersion: expectedVersion, version: Number(saved.version) },
      });
      await client.query("COMMIT");
      return { projectId, version: Number(saved.version), source };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function rollback(client: { query(text: string): Promise<unknown> }): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original error when the connection has closed.
  }
}

function projectVersionConflict(): ApplicationError {
  return new ApplicationError(409, "project_version_conflict", "Project changed", "This project was updated by another user. Reload it before saving again.");
}
