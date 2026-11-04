import type { ProjectCollaborator } from "../contracts.ts";
import type { ProjectActor } from "./project-repository.ts";
import { insertAuditEvent } from "./project-repository-audit.ts";
import { rollbackProjectTransaction } from "./project-repository-transaction.ts";
import type { SqlPool } from "./sql.ts";

interface CollaboratorRow extends Record<string, unknown> {
  user_id: string;
  role: "editor";
  granted_by: string;
  created_at: Date | string;
}

/** Persists project collaborator grants and their recovery audit events. */
export class PostgresProjectCollaboratorRepository {
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async listCollaborators(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCollaborator[] | null> {
    const projectResult = await this.pool.query<{ created_by: string }>(
      `SELECT created_by FROM vdab_projects
       WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
         AND (created_by = $3 OR $4)
       LIMIT 1`,
      [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
    );

    if (!projectResult.rows[0]) {
      return null;
    }

    const result = await this.pool.query<CollaboratorRow>(
      `SELECT user_id, role, granted_by, created_at
       FROM vdab_project_collaborators
       WHERE project_id = $1
       ORDER BY created_at, user_id`,
      [projectId],
    );

    if (
      actor.isInstallationAdmin &&
      projectResult.rows[0].created_by !== actor.userId
    ) {
      await insertAuditEvent(this.pool, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.collaborators.read.recovery",
        requestId: actor.requestId,
      });
    }

    return result.rows.map((row) => ({
      userId: row.user_id,
      role: row.role,
      grantedBy: row.granted_by,
      createdAt: toIsoString(row.created_at),
    }));
  }

  async grantEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const ownerResult = await client.query<{ created_by: string }>(
        `SELECT created_by FROM vdab_projects
         WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
           AND (created_by = $3 OR $4)
         FOR UPDATE`,
        [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
      );

      if (!ownerResult.rows[0]) {
        await client.query("ROLLBACK");
        return false;
      }

      await client.query(
        `INSERT INTO vdab_project_collaborators
          (project_id, user_id, role, granted_by)
         VALUES ($1, $2, 'editor', $3)
         ON CONFLICT (project_id, user_id)
         DO UPDATE SET role = 'editor', granted_by = EXCLUDED.granted_by,
                       created_at = now()`,
        [projectId, collaboratorId, actor.userId],
      );
      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.collaborator.grant-editor",
        requestId: actor.requestId,
        metadata: { targetUserId: collaboratorId },
      });
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await rollbackProjectTransaction(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async removeEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const ownerResult = await client.query<{ created_by: string }>(
        `SELECT created_by FROM vdab_projects
         WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
           AND (created_by = $3 OR $4)
         FOR UPDATE`,
        [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
      );

      const owner = ownerResult.rows[0];

      if (!owner) {
        await client.query("ROLLBACK");
        return false;
      }

      const removal = await client.query<{ user_id: string }>(
        `DELETE FROM vdab_project_collaborators
         WHERE project_id = $1 AND user_id = $2 AND user_id <> $3 AND user_id <> $4
         RETURNING user_id`,
        [projectId, collaboratorId, owner.created_by, actor.userId],
      );

      if ((removal.rowCount ?? 0) > 0) {
        await insertAuditEvent(client, {
          workspaceId: actor.workspaceId,
          projectId,
          actorId: actor.userId,
          action: "project.collaborator.revoke-editor",
          requestId: actor.requestId,
          metadata: { targetUserId: collaboratorId },
        });
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await rollbackProjectTransaction(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
