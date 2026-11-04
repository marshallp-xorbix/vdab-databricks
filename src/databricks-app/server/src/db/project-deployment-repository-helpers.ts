import { randomUUID } from "node:crypto";
import { ApplicationError } from "../application-error.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { SqlClient, SqlPool } from "./sql.ts";
import type { ChildAppRow } from "./project-deployment-repository-mapping.ts";
/** Checks that an actor may modify the project and locks it for the transaction. */ export async function requireProjectWriteAccess(
  client: SqlClient,
  projectId: string,
  actor: ProjectActor,
): Promise<void> {
  const result = await client.query<{
    created_by: string;
    role: string | null;
  }>(
    `SELECT project.created_by, collaborator.role
     FROM vdab_projects project
     LEFT JOIN vdab_project_collaborators collaborator
       ON collaborator.project_id = project.id AND collaborator.user_id = $3
     WHERE project.id = $1 AND project.workspace_id = $2 AND project.deleted_at IS NULL
       AND (project.created_by = $3 OR collaborator.user_id IS NOT NULL OR $4)
     FOR UPDATE OF project`,
    [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
  );
  const row = result.rows[0];
  if (!row) throw projectNotFound();
  if (
    row.created_by !== actor.userId &&
    row.role !== "editor" &&
    !actor.isInstallationAdmin
  ) {
    throw new ApplicationError(
      403,
      "project_edit_permission_required",
      "Project edit permission required",
      "Only project editors can deploy this child App.",
    );
  }
}

/** Checks project visibility before reading deployment history. */
export async function requireProjectReadAccess(
  pool: SqlPool,
  projectId: string,
  actor: ProjectActor,
): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `SELECT project.id
     FROM vdab_projects project
     LEFT JOIN vdab_project_collaborators collaborator
       ON collaborator.project_id = project.id AND collaborator.user_id = $3
     WHERE project.id = $1 AND project.workspace_id = $2 AND project.deleted_at IS NULL
       AND (project.created_by = $3 OR collaborator.user_id IS NOT NULL OR $4)
     LIMIT 1`,
    [projectId, actor.workspaceId, actor.userId, actor.isInstallationAdmin],
  );
  if (!result.rows[0]) throw projectNotFound();
}

/** Reads the linked child App, optionally locking its row. */
export async function readChildApp(
  client: SqlClient,
  projectId: string,
  forUpdate: boolean,
): Promise<ChildAppRow | null> {
  const result = await client.query<ChildAppRow>(
    `SELECT workspace_app_id, app_name, link_mode, source_code_path, create_marker
     FROM vdab_project_child_apps WHERE project_id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [projectId],
  );
  return result.rows[0] ?? null;
}

/** Persists one deployment lifecycle audit event in the current transaction. */
export async function insertDeploymentAudit(
  client: SqlClient,
  actor: ProjectActor,
  projectId: string,
  requestId: string,
  action: string,
  metadata: Record<string, unknown>,
  outcome: "success" | "failure",
): Promise<void> {
  await client.query(
    `INSERT INTO vdab_audit_events
       (id, workspace_id, project_id, actor_id, action, outcome, source_request_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      randomUUID(),
      actor.workspaceId,
      projectId,
      actor.userId,
      action,
      outcome,
      requestId,
      JSON.stringify(metadata),
    ],
  );
}

/** Recognizes the active-deployment uniqueness constraint. */
export function isActiveDeploymentConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "ux_vdab_project_deployments_active"
  );
}

/** Recognizes a conflicting linked child-App target. */
export function isChildAppTargetConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    (error.constraint === "ux_vdab_project_child_apps_workspace_app_name" ||
      error.constraint === "ux_vdab_project_child_apps_workspace_app_id")
  );
}

/** Attempts transaction rollback without hiding the original failure. */
export function rollback(client: SqlClient): Promise<void> {
  return client
    .query("ROLLBACK")
    .then(() => undefined)
    .catch(() => undefined);
}

function projectNotFound(): ApplicationError {
  return new ApplicationError(
    404,
    "project_not_found",
    "Project not found",
    "The requested project does not exist or is not available to you.",
  );
}

/** Creates the typed not-found result for a deployment record. */
export function deploymentNotFound(): ApplicationError {
  return new ApplicationError(
    404,
    "deployment_not_found",
    "Deployment not found",
    "The requested deployment does not exist or is not available to you.",
  );
}

/** Creates the typed conflict for a project without a linked child App. */
export function childAppNotLinked(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_not_linked",
    "Child App is not linked",
    "Link or create a child App before retrying or rolling back a deployment.",
  );
}

/** Creates the typed conflict when a project targets a different App. */
export function childAppAlreadyLinked(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_already_linked",
    "Project already has a child App",
    "This project already targets another child App. Use its deployment history or create a separate project.",
  );
}

/** Creates the typed conflict when another deployment is active. */
export function activeDeploymentConflict(): ApplicationError {
  return new ApplicationError(
    409,
    "deployment_in_progress",
    "Deployment already in progress",
    "Wait for the current child-App deployment to finish before starting another.",
  );
}
