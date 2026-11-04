import { randomUUID } from "node:crypto";
import type { ProjectCollaborator, ProjectSummary, ProjectDeploymentSettings } from "../contracts.ts";
import { readProjectDeploymentSettings } from "../project-deployment-settings.ts";
import { ApplicationError } from "../application-error.ts";
import { PostgresProjectCollaboratorRepository } from "./project-collaborator-repository.ts";
import { insertAuditEvent } from "./project-repository-audit.ts";
import { rollbackProjectTransaction } from "./project-repository-transaction.ts";
import type { SqlPool } from "./sql.ts";

export { insertAuditEvent } from "./project-repository-audit.ts";

/** Trusted caller data used by project persistence authorization predicates. */
export interface ProjectActor {
  workspaceId: string;
  userId: string;
  isInstallationAdmin: boolean;
  requestId: string;
}

/** Values required to create an install-local project. */
export interface NewProject {
  deploymentSettings?: ProjectDeploymentSettings | null;
  workspaceId: string;
  actorId: string;
  name: string;
  description: string | null;
  requestId: string;
}

/** Editable metadata accepted from an authorized project member. */
export interface ProjectMetadata {
  deploymentSettings?: ProjectDeploymentSettings | null;
  name: string;
  description: string | null;
  theme?: Record<string, unknown> | null;
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
  getProject(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null>;
  updateProject(
    projectId: string,
    metadata: ProjectMetadata,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null>;
  deleteProject(projectId: string, actor: ProjectActor): Promise<boolean>;
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
  deployment_settings?: unknown;
  id: string;
  name: string;
  description: string | null;
  theme?: unknown;
  version: number;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  caller_role?: ProjectSummary["callerRole"];
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
  private readonly collaboratorRepository: PostgresProjectCollaboratorRepository;

  constructor(pool: SqlPool) {
    this.pool = pool;
    this.collaboratorRepository = new PostgresProjectCollaboratorRepository(
      pool,
    );
  }

  async createProject(input: NewProject): Promise<ProjectSummary> {
    const projectId = randomUUID();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await client.query<ProjectRow>(
        `INSERT INTO vdab_projects
          (id, workspace_id, name, description, created_by, deployment_settings)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id, name, description, theme, deployment_settings, version, created_by, created_at, updated_at`,
        [
          projectId,
          input.workspaceId,
          input.name,
          input.description,
          input.actorId,
          input.deploymentSettings ? JSON.stringify(input.deploymentSettings) : null,
        ],
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
      await rollbackProjectTransaction(client);

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
      `SELECT p.id, p.name, p.description, p.theme, p.deployment_settings, p.version, p.created_by,
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
      `SELECT p.id, p.name, p.description, p.theme, p.deployment_settings, p.version, p.created_by,
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
         SET name = $5, description = $6,
             theme = CASE WHEN $8 THEN $9::jsonb ELSE p.theme END,
             deployment_settings = CASE WHEN $10 THEN $11::jsonb ELSE p.deployment_settings END,
             version = p.version + 1, updated_at = now()
         WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
           AND p.version = $3
           AND (p.created_by = $4 OR EXISTS (
             SELECT 1 FROM vdab_project_collaborators AS c
             WHERE c.project_id = p.id AND c.user_id = $4 AND c.role = 'editor'
           ) OR $7)
         RETURNING p.id, p.name, p.description, p.theme, p.deployment_settings, p.version, p.created_by,
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
          metadata.theme !== undefined,
          metadata.theme === undefined ? null : JSON.stringify(metadata.theme),
          metadata.deploymentSettings !== undefined,
          metadata.deploymentSettings ? JSON.stringify(metadata.deploymentSettings) : null,
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
          [
            projectId,
            actor.workspaceId,
            actor.userId,
            actor.isInstallationAdmin,
          ],
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
      await rollbackProjectTransaction(client);

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

  /** Soft-deletes an owned project and records the action in one transaction. */
  async deleteProject(
    projectId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const deletion = await client.query<{ created_by: string }>(
        `UPDATE vdab_projects
         SET deleted_at = now(), version = version + 1, updated_at = now()
         WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
           AND (created_by = $3 OR $4)
         RETURNING created_by`,
        [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
      );
      const project = deletion.rows[0];

      if (!project) {
        await client.query("ROLLBACK");
        return false;
      }

      await insertAuditEvent(client, {
        workspaceId: actor.workspaceId,
        projectId,
        actorId: actor.userId,
        action:
          actor.isInstallationAdmin && project.created_by !== actor.userId
            ? "project.delete.recovery"
            : "project.delete",
        requestId: actor.requestId,
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

  async listCollaborators(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCollaborator[] | null> {
    return this.collaboratorRepository.listCollaborators(projectId, actor);
  }

  async grantEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    return this.collaboratorRepository.grantEditor(
      projectId,
      collaboratorId,
      actor,
    );
  }

  async removeEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    return this.collaboratorRepository.removeEditor(
      projectId,
      collaboratorId,
      actor,
    );
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
    ...(row.theme === undefined ? {} : { theme: readNullableJsonObject(row.theme) }),
    ...(row.deployment_settings === undefined ? {} : { deploymentSettings: readProjectDeploymentSettings(row.deployment_settings) }),
    version: Number(row.version),
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    callerRole,
  };
}

function readNullableJsonObject(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (typeof value === "string") {
    try {
      return readNullableJsonObject(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
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
