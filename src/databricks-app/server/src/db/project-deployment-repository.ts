import { randomUUID } from "node:crypto";
import type {
  ProjectChildAppLink,
  ProjectChildAppMode,
  ProjectDeploymentSourceFile,
  ProjectDeploymentStatus,
  ProjectDeploymentSummary,
  WorkspaceAppResource,
} from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { SqlClient, SqlPool } from "./sql.ts";
import {
  addDeploymentUpdateValue,
  DEPLOYMENT_SELECT,
  isTerminalDeploymentStatus,
  readDeploymentScopeArray,
  readDeploymentAppResourceArray,
  readDeploymentSourceFiles,
  toChildAppRecord,
  toDeploymentRecord,
  toDeploymentSummary,
} from "./project-deployment-repository-mapping.ts";
import type {
  ChildAppRow,
  DeploymentRow,
} from "./project-deployment-repository-mapping.ts";
import {
  activeDeploymentConflict,
  childAppAlreadyLinked,
  childAppNotLinked,
  deploymentNotFound,
  insertDeploymentAudit,
  isActiveDeploymentConflict,
  isChildAppTargetConflict,
  readChildApp,
  requireProjectReadAccess,
  requireProjectWriteAccess,
  rollback,
} from "./project-deployment-repository-helpers.ts";

/** Source snapshot retained privately for retry and rollback. */
export interface ProjectDeploymentRecord extends ProjectDeploymentSummary {
  sourceFiles: ProjectDeploymentSourceFile[];
  appId: string | null;
  requiredUserApiScopes: string[];
  requiredAppResources: WorkspaceAppResource[];
}

/** Private lifecycle metadata required to recover an interrupted App create. */
export interface ProjectChildAppRecord extends ProjectChildAppLink {
  createMarker: string | null;
}

/** Input persisted before any irreversible workspace mutation begins. */
export interface NewProjectDeployment {
  appName: string;
  mode: ProjectChildAppMode;
  appId: string | null;
  createMarker: string | null;
  sourceVersion: number;
  sourceFiles: ProjectDeploymentSourceFile[];
  requiredUserApiScopes: string[];
  requiredAppResources: WorkspaceAppResource[];
}

/** State changes written after one caller-authorized Databricks operation. */
export interface ProjectDeploymentUpdate {
  action: string;
  status?: ProjectDeploymentStatus;
  appId?: string;
  sourceCodePath?: string;
  deploymentId?: string;
  failureCode?: string | null;
}

/** Durable ACL-scoped child-App and deployment history boundary. */
export interface ProjectDeploymentRepository {
  getChildApp(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectChildAppRecord | null>;
  createDeployment(
    projectId: string,
    actor: ProjectActor,
    input: NewProjectDeployment,
    requestId: string,
  ): Promise<ProjectDeploymentRecord>;
  createRecoveryDeployment(
    projectId: string,
    actor: ProjectActor,
    sourceDeploymentId: string,
    mode: "retry" | "rollback",
    requestId: string,
  ): Promise<ProjectDeploymentRecord>;
  listDeployments(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectDeploymentSummary[]>;
  getDeployment(
    projectId: string,
    deploymentId: string,
    actor: ProjectActor,
  ): Promise<ProjectDeploymentRecord | null>;
  updateDeployment(
    projectId: string,
    deploymentId: string,
    actor: ProjectActor,
    update: ProjectDeploymentUpdate,
  ): Promise<ProjectDeploymentRecord | null>;
}

/** PostgreSQL implementation for immutable generated source and audit history. */
export class PostgresProjectDeploymentRepository implements ProjectDeploymentRepository {
  private readonly pool: SqlPool;

  constructor(pool: SqlPool) {
    this.pool = pool;
  }

  async getChildApp(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectChildAppRecord | null> {
    const authorized = await this.pool.query<ChildAppRow>(
      `SELECT child.workspace_app_id, child.app_name, child.link_mode,
              child.source_code_path, child.create_marker
       FROM vdab_projects project
       LEFT JOIN vdab_project_collaborators collaborator
         ON collaborator.project_id = project.id AND collaborator.user_id = $3
       JOIN vdab_project_child_apps child ON child.project_id = project.id
       WHERE project.id = $1 AND project.workspace_id = $2
         AND project.deleted_at IS NULL
         AND (project.created_by = $3 OR collaborator.user_id IS NOT NULL OR $4)
       LIMIT 1`,
      [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
    );
    const row = authorized.rows[0];
    return row ? toChildAppRecord(row) : null;
  }

  async createDeployment(
    projectId: string,
    actor: ProjectActor,
    input: NewProjectDeployment,
    requestId: string,
  ): Promise<ProjectDeploymentRecord> {
    const deploymentId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireProjectWriteAccess(client, projectId, actor);
      const currentChildApp = await readChildApp(client, projectId, true);
      if (currentChildApp && currentChildApp.app_name !== input.appName) {
        throw childAppAlreadyLinked();
      }
      if (!currentChildApp) {
        await client.query(
          `INSERT INTO vdab_project_child_apps
             (project_id, workspace_app_id, app_name, link_mode, linked_by, create_marker)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            projectId,
            input.appId,
            input.appName,
            input.mode,
            actor.userId,
            input.createMarker,
          ],
        );
      }
      const inserted = await client.query<DeploymentRow>(
        `INSERT INTO vdab_project_deployments
           (id, project_id, actor_id, source_version, source_snapshot, status,
            app_name, attempt_of, required_user_api_scopes, required_app_resources)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6, NULL, $7::jsonb, $8::jsonb)
         RETURNING id, project_id, app_name, source_version, source_snapshot,
                   databricks_deployment_id, source_code_path, status, failure_code,
                   attempt_of, created_at, completed_at, required_user_api_scopes,
                   required_app_resources`,
        [
          deploymentId,
          projectId,
          actor.userId,
          input.sourceVersion,
          JSON.stringify(input.sourceFiles),
          input.appName,
          JSON.stringify(input.requiredUserApiScopes),
          JSON.stringify(input.requiredAppResources),
        ],
      );
      await insertDeploymentAudit(
        client,
        actor,
        projectId,
        requestId,
        "deployment.started",
        {
          appName: input.appName,
          mode: input.mode,
          deploymentRecordId: deploymentId,
        },
        "success",
      );
      await client.query("COMMIT");
      const record = inserted.rows[0];
      if (!record)
        throw new Error("PostgreSQL did not return the deployment record.");
      return toDeploymentRecord(
        record,
        input.mode,
        input.mode,
        typeof currentChildApp?.workspace_app_id === "string"
          ? currentChildApp.workspace_app_id
          : input.appId,
        typeof currentChildApp?.source_code_path === "string"
          ? currentChildApp.source_code_path
          : null,
      );
    } catch (error) {
      await rollback(client);
      if (isActiveDeploymentConflict(error)) throw activeDeploymentConflict();
      if (isChildAppTargetConflict(error)) throw childAppAlreadyLinked();
      throw error;
    } finally {
      client.release();
    }
  }

  async createRecoveryDeployment(
    projectId: string,
    actor: ProjectActor,
    sourceDeploymentId: string,
    mode: "retry" | "rollback",
    requestId: string,
  ): Promise<ProjectDeploymentRecord> {
    const deploymentId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireProjectWriteAccess(client, projectId, actor);
      if (mode === "rollback") {
        const latestSuccessful = await client.query<{ id: string }>(
          `SELECT id FROM vdab_project_deployments
           WHERE project_id = $1 AND status = 'succeeded'
           ORDER BY completed_at DESC NULLS LAST, created_at DESC
           LIMIT 1`,
          [projectId],
        );
        if (latestSuccessful.rows[0]?.id !== sourceDeploymentId) {
          throw new ApplicationError(
            409,
            "rollback_target_not_latest",
            "Rollback target changed",
            "Choose the latest successful deployment before rolling back.",
          );
        }
      }
      const sourceResult = await client.query<DeploymentRow>(
        `SELECT deployment.id, deployment.project_id, deployment.app_name,
                deployment.source_version, deployment.source_snapshot,
                deployment.databricks_deployment_id, deployment.source_code_path,
                deployment.status, deployment.failure_code, deployment.attempt_of,
                deployment.created_at, deployment.completed_at,
                deployment.required_user_api_scopes,
                deployment.required_app_resources,
                child.workspace_app_id AS app_id, child.link_mode,
                child.source_code_path AS linked_source_path
         FROM vdab_project_deployments deployment
         LEFT JOIN vdab_project_child_apps child ON child.project_id = deployment.project_id
         WHERE deployment.id = $1 AND deployment.project_id = $2
         FOR UPDATE OF deployment`,
        [sourceDeploymentId, projectId],
      );
      const source = sourceResult.rows[0];
      if (!source) throw deploymentNotFound();
      if (
        mode === "retry" &&
        !["failed", "cancelled"].includes(source.status)
      ) {
        throw new ApplicationError(
          409,
          "deployment_not_retryable",
          "Deployment cannot be retried",
          "Retry is available only after a deployment fails or is cancelled.",
        );
      }
      if (mode === "rollback" && source.status !== "succeeded") {
        throw new ApplicationError(
          409,
          "deployment_not_rollback_target",
          "Rollback target is unavailable",
          "Choose a successful deployment as the rollback target.",
        );
      }
      const appName = source.app_name;
      if (!appName || !source.link_mode) throw childAppNotLinked();
      const inserted = await client.query<DeploymentRow>(
        `INSERT INTO vdab_project_deployments
           (id, project_id, actor_id, source_version, source_snapshot, status,
            app_name, attempt_of, required_user_api_scopes, required_app_resources)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6, $7, $8::jsonb, $9::jsonb)
         RETURNING id, project_id, app_name, source_version, source_snapshot,
                   databricks_deployment_id, source_code_path, status, failure_code,
                   attempt_of, created_at, completed_at, required_user_api_scopes,
                   required_app_resources`,
        [
          deploymentId,
          projectId,
          actor.userId,
          source.source_version,
          JSON.stringify(readDeploymentSourceFiles(source.source_snapshot)),
          appName,
          sourceDeploymentId,
          JSON.stringify(
            readDeploymentScopeArray(source.required_user_api_scopes),
          ),
          JSON.stringify(
            readDeploymentAppResourceArray(source.required_app_resources),
          ),
        ],
      );
      await insertDeploymentAudit(
        client,
        actor,
        projectId,
        requestId,
        `deployment.${mode}`,
        {
          appName,
          deploymentRecordId: deploymentId,
          sourceDeploymentId,
        },
        "success",
      );
      await client.query("COMMIT");
      const record = inserted.rows[0];
      if (!record)
        throw new Error(
          "PostgreSQL did not return the recovery deployment record.",
        );
      return toDeploymentRecord(
        record,
        source.link_mode,
        source.link_mode,
        typeof source.app_id === "string" ? source.app_id : null,
        typeof source.linked_source_path === "string"
          ? source.linked_source_path
          : null,
      );
    } catch (error) {
      await rollback(client);
      if (isActiveDeploymentConflict(error)) throw activeDeploymentConflict();
      throw error;
    } finally {
      client.release();
    }
  }

  async listDeployments(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectDeploymentSummary[]> {
    await requireProjectReadAccess(this.pool, projectId, actor);
    const result = await this.pool.query<DeploymentRow>(
      `${DEPLOYMENT_SELECT}
       WHERE deployment.project_id = $1
       ORDER BY deployment.created_at DESC
       LIMIT 50`,
      [projectId],
    );
    return result.rows.map((row) =>
      toDeploymentSummary(
        toDeploymentRecord(
          row,
          row.link_mode,
          row.link_mode,
          row.app_id,
          row.linked_source_path,
        ),
      ),
    );
  }

  async getDeployment(
    projectId: string,
    deploymentId: string,
    actor: ProjectActor,
  ): Promise<ProjectDeploymentRecord | null> {
    await requireProjectReadAccess(this.pool, projectId, actor);
    const result = await this.pool.query<DeploymentRow>(
      `${DEPLOYMENT_SELECT}
       WHERE deployment.project_id = $1 AND deployment.id = $2
       LIMIT 1`,
      [projectId, deploymentId],
    );
    const row = result.rows[0];
    return row
      ? toDeploymentRecord(
          row,
          row.link_mode,
          row.link_mode,
          row.app_id,
          row.linked_source_path,
        )
      : null;
  }

  async updateDeployment(
    projectId: string,
    deploymentId: string,
    actor: ProjectActor,
    update: ProjectDeploymentUpdate,
  ): Promise<ProjectDeploymentRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireProjectWriteAccess(client, projectId, actor);
      const values: unknown[] = [projectId, deploymentId];
      const set: string[] = ["updated_at = now()"];
      addDeploymentUpdateValue(
        set,
        values,
        "databricks_deployment_id",
        update.deploymentId,
      );
      addDeploymentUpdateValue(
        set,
        values,
        "source_code_path",
        update.sourceCodePath,
      );
      addDeploymentUpdateValue(set, values, "status", update.status);
      addDeploymentUpdateValue(set, values, "failure_code", update.failureCode);
      if (update.status && isTerminalDeploymentStatus(update.status))
        set.push("completed_at = now()");
      const updated = await client.query<DeploymentRow>(
        `UPDATE vdab_project_deployments deployment
         SET ${set.join(", ")}
         WHERE deployment.project_id = $1 AND deployment.id = $2
         RETURNING deployment.id, deployment.project_id, deployment.app_name,
                   deployment.source_version, deployment.source_snapshot,
                   deployment.databricks_deployment_id, deployment.source_code_path,
                   deployment.status, deployment.failure_code, deployment.attempt_of,
                   deployment.created_at, deployment.completed_at,
                   deployment.required_user_api_scopes,
                   deployment.required_app_resources`,
        values,
      );
      const row = updated.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      if (update.appId !== undefined || update.sourceCodePath !== undefined) {
        await client.query(
          `UPDATE vdab_project_child_apps
           SET workspace_app_id = COALESCE($2, workspace_app_id),
               source_code_path = COALESCE($3, source_code_path)
           WHERE project_id = $1`,
          [projectId, update.appId ?? null, update.sourceCodePath ?? null],
        );
      }
      const childApp = await readChildApp(client, projectId, false);
      await insertDeploymentAudit(
        client,
        actor,
        projectId,
        actor.requestId,
        update.action,
        {
          appName: row.app_name,
          deploymentRecordId: deploymentId,
          deploymentId: update.deploymentId ?? null,
          status: update.status ?? null,
          failureCode: update.failureCode ?? null,
        },
        update.status === "failed" ? "failure" : "success",
      );
      await client.query("COMMIT");
      return toDeploymentRecord(
        row,
        childApp?.link_mode ?? null,
        childApp?.link_mode ?? null,
        childApp?.workspace_app_id ?? null,
        childApp?.source_code_path ?? null,
      );
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
