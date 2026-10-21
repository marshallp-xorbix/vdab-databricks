import { randomUUID } from "node:crypto";
import type { ProjectCollaborator, ProjectSummary } from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";
import type { SqlPool } from "./sql.ts";

/** Trusted caller data used by project persistence authorization predicates. */
export interface ProjectActor {
  workspaceId: string;
  userId: string;
  isInstallationAdmin: boolean;
  requestId: string;
}

/** Values required to create an install-local project. */
export interface NewProject {
  workspaceId: string;
  actorId: string;
  name: string;
  description: string | null;
  requestId: string;
}

/** Editable metadata accepted from an authorized project member. */
export interface ProjectMetadata {
  name: string;
  description: string | null;
  expectedVersion: number;
}

/** Fields shared by transactional project audit writes. */
export interface ProjectAuditEvent {
  workspaceId: string;
  projectId: string | null;
  actorId: string;
  action: string;
  requestId: string;
  parameterizeOutcome?: boolean;
  metadata?: Record<string, unknown>;
}

/** Persistence boundary for install-local projects and collaborator grants. */
export interface ProjectRepository {
  createProject(input: NewProject): Promise<ProjectSummary>;
  listProjects(actor: ProjectActor): Promise<ProjectSummary[]>;
  getProject(projectId: string, actor: ProjectActor): Promise<ProjectSummary | null>;
  updateProject(
    projectId: string,
    metadata: ProjectMetadata,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null>;
  listCollaborators(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCollaborator[] | null>;
  grantEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean>;
  removeEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean>;
}

interface ProjectRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  version: number;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  caller_role?: ProjectSummary["callerRole"];
}

interface CollaboratorRow extends Record<string, unknown> {
  user_id: string;
  role: "editor";
  granted_by: string;
  created_at: Date | string;
}

const PROJECT_NOT_FOUND = () =>
  new ApplicationError(
    404,
    "project_not_found",
    "Project not found",
    "The requested project does not exist or is not available to you.",
  );

/** PostgreSQL implementation using parameterized queries and explicit transactions. */
export class PostgresProjectRepository implements ProjectRepository {
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async createProject(input: NewProject): Promise<ProjectSummary> {
    const projectId = randomUUID();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await client.query<ProjectRow>(
        `INSERT INTO vdab_projects
          (id, workspace_id, name, description, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, version, created_by, created_at, updated_at`,
        [projectId, input.workspaceId, input.name, input.description, input.actorId],
      );
      const row = requireRow(result.rows[0]);
      await insertAuditEvent(client, {
        workspaceId: input.workspaceId,
        projectId,
        actorId: input.actorId,
        action: "project.create",
        requestId: input.requestId,
        parameterizeOutcome: true,
      });
      await client.query("COMMIT");
      return toProjectSummary(row, "owner");
    } catch (error) {
      await rollback(client);

      if (isProjectNameConflict(error)) {
        throw new ApplicationError(
          409,
          "project_name_conflict",
          "Project name already exists",
          "Choose another project name in this workspace.",
        );
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async listProjects(actor: ProjectActor): Promise<ProjectSummary[]> {
    const result = await this.pool.query<ProjectRow>(
      `SELECT p.id, p.name, p.description, p.version, p.created_by,
              p.created_at, p.updated_at,
              CASE WHEN p.created_by = $1 THEN 'owner'
                   WHEN $3 THEN 'installationAdmin'
                   WHEN c.user_id = $1 THEN c.role
                   ELSE 'viewer' END AS caller_role
       FROM vdab_projects p
       LEFT JOIN vdab_project_collaborators c
         ON c.project_id = p.id AND c.user_id = $1
       WHERE p.workspace_id = $2 AND p.deleted_at IS NULL
         AND (p.created_by = $1 OR c.user_id = $1 OR $3)
       ORDER BY p.updated_at DESC, p.id`,
      [actor.userId, actor.workspaceId, actor.isInstallationAdmin],
    );

    const projects = result.rows.map((row) =>
      toProjectSummary(row, row.caller_role ?? "viewer"),
    );

    if (actor.isInstallationAdmin) {
      await insertAuditEvent(this.pool, {
        workspaceId: actor.workspaceId,
        projectId: null,
        actorId: actor.userId,
        action: "project.list.recovery",
        requestId: actor.requestId,
        metadata: { count: projects.length },
      });
    }

    return projects;
  }

  async getProject(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null> {
    const result = await this.pool.query<ProjectRow>(
      `SELECT p.id, p.name, p.description, p.version, p.created_by,
              p.created_at, p.updated_at,
              CASE WHEN p.created_by = $1 THEN 'owner'
                   WHEN $4 THEN 'installationAdmin'
                   WHEN c.user_id = $1 THEN c.role
                   ELSE 'viewer' END AS caller_role
       FROM vdab_projects p
       LEFT JOIN vdab_project_collaborators c
         ON c.project_id = p.id AND c.user_id = $1
       WHERE p.id = $2 AND p.workspace_id = $3 AND p.deleted_at IS NULL
         AND (p.created_by = $1 OR c.user_id = $1 OR $4)
       LIMIT 1`,
      [actor.userId, projectId, actor.workspaceId, actor.isInstallationAdmin],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const project = toProjectSummary(row, row.caller_role ?? "viewer");

    if (actor.isInstallationAdmin && project.createdBy !== actor.userId) {
      await insertAuditEvent(this.pool, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action: "project.read",
        requestId: actor.requestId,
      });
    }

    return project;
  }

  async updateProject(
    projectId: string,
    metadata: ProjectMetadata,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const updateResult = await client.query<ProjectRow>(
        `UPDATE vdab_projects AS p
         SET name = $5, description = $6, version = p.version + 1, updated_at = now()
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
           AND p.version = $3
           AND (p.created_by = $4 OR EXISTS (
             SELECT 1 FROM vdab_project_collaborators AS c
             WHERE c.project_id = p.id AND c.user_id = $4 AND c.role = 'editor'
           ) OR $7)
         RETURNING p.id, p.name, p.description, p.version, p.created_by,
                   p.created_at, p.updated_at,
                   CASE WHEN p.created_by = $4 THEN 'owner'
                        WHEN $7 THEN 'installationAdmin'
                        ELSE 'editor' END AS caller_role`,
        [
          projectId,
          actor.workspaceId,
          metadata.expectedVersion,
          actor.userId,
          metadata.name,
          metadata.description,
          actor.isInstallationAdmin,
        ],
      );
      const row = updateResult.rows[0];

      if (!row) {
        const accessibleProject = await client.query<{ id: string }>(
          `SELECT p.id FROM vdab_projects AS p
           WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
             AND (p.created_by = $3 OR EXISTS (
               SELECT 1 FROM vdab_project_collaborators AS c
               WHERE c.project_id = p.id AND c.user_id = $3 AND c.role = 'editor'
             ) OR $4)
           LIMIT 1`,
          [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
        );

        if (accessibleProject.rows[0]) {
          throw new ApplicationError(
            409,
            "project_version_conflict",
            "Project changed",
            "This project was updated by another user. Reload it before saving again.",
          );
        }

        await client.query("ROLLBACK");
        return null;
      }

      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action:
          actor.isInstallationAdmin && row.created_by !== actor.userId
            ? "project.metadata.update.recovery"
            : "project.metadata.update",
        requestId: actor.requestId,
        metadata: {
          previousVersion: metadata.expectedVersion,
          version: Number(row.version),
        },
      });
      await client.query("COMMIT");
      return toProjectSummary(row, row.caller_role ?? "viewer");
    } catch (error) {
      await rollback(client);

      if (isProjectNameConflict(error)) {
        throw new ApplicationError(
          409,
          "project_name_conflict",
          "Project name already exists",
          "Choose another project name in this workspace.",
        );
      }

      throw error;
    } finally {
      client.release();
    }
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
      await rollback(client);
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
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Appends a parameterized install-local audit event on the supplied connection. */
export async function insertAuditEvent(
  client: Pick<SqlPool, "query">,
  event: ProjectAuditEvent,
): Promise<void> {
  const values: unknown[] = [
    randomUUID(),
    event.workspaceId,
    event.projectId,
    event.actorId,
    event.action,
  ];
  if (event.parameterizeOutcome) {
    values.push("success");
  }

  values.push(event.requestId);

  if (event.metadata) {
    values.push(JSON.stringify(event.metadata));
  }

  const placeholders = values.map((_, index) => `$${index + 1}`);
  const query = event.parameterizeOutcome
    ? `INSERT INTO vdab_audit_events
        (id, workspace_id, project_id, actor_id, action, outcome, source_request_id${event.metadata ? ", metadata" : ""})
       VALUES (${placeholders.join(", ")})`
    : `INSERT INTO vdab_audit_events
        (id, workspace_id, project_id, actor_id, action, source_request_id, outcome${event.metadata ? ", metadata" : ""})
       VALUES (${placeholders.slice(0, 5).join(", ")}, ${placeholders[5]}, 'success'${event.metadata ? `, ${placeholders[6]}` : ""})`;

  await client.query(query, values);
}

async function rollback(client: { query(text: string): Promise<unknown> }): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original repository error when PostgreSQL has ended the transaction.
  }
}

function requireRow(row: ProjectRow | undefined): ProjectRow {
  if (!row) {
    throw new Error("PostgreSQL did not return the created project.");
  }

  return row;
}

function toProjectSummary(
  row: ProjectRow,
  callerRole: ProjectSummary["callerRole"],
): ProjectSummary {
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
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isProjectNameConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "ux_vdab_projects_workspace_name"
  );
}
