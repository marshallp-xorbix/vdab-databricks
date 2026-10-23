import {
  ProjectDeploymentHistory,
  ProjectDeploymentReadiness,
  ProjectDeploymentSummary,
  WorkspaceAppDeploymentTarget,
  type IProjectDeploymentHistory,
  type IProjectDeploymentReadiness,
  type IProjectDeploymentSummary,
  type IWorkspaceAppResource,
  type IWorkspaceAppDeploymentTarget,
  type IWorkspaceSecretAppResource,
  type IWorkspaceSecretResourceSelection,
  type ProjectChildAppMode,
  type ProjectDeploymentStatus,
} from "../models/ProjectDeployments";

const PROJECTS_PATH = "/api/v1/projects";
const WORKSPACE_APPS_PATH = "/api/v1/workspace/apps";
const MAX_SECRET_IDENTIFIER_LENGTH = 128;
const ASCII_CONTROL_CHARACTER_MAX = 0x1f;
const DELETE_CONTROL_CHARACTER = 0x7f;

/** Reads the ACL-filtered child-App link and deployment history for one project. */
export async function getProjectDeploymentHistory(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProjectDeploymentHistory> {
  const response = await fetch(`${projectPath(projectId)}/deployments`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseDeploymentHistory(await response.json());
}

/** Computes generator scopes and blockers without calling the workspace APIs. */
export async function getProjectDeploymentReadiness(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProjectDeploymentReadiness> {
  const response = await fetch(
    `${projectPath(projectId)}/deployments/readiness`,
    {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    },
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const value: unknown = await response.json();
  if (
    !isRecord(value) ||
    !Array.isArray(value.userApiScopes) ||
    value.userApiScopes.some((scope) => typeof scope !== "string") ||
    !Array.isArray(value.appResources) ||
    !value.appResources.every(isWorkspaceAppResource) ||
    !Array.isArray(value.blockers) ||
    value.blockers.some(
      (blocker) =>
        !isRecord(blocker) ||
        typeof blocker.code !== "string" ||
        typeof blocker.detail !== "string",
    )
  ) {
    throw new Error(
      "The deployment service returned invalid readiness details.",
    );
  }
  return new ProjectDeploymentReadiness({
    userApiScopes: value.userApiScopes as string[],
    appResources: value.appResources as IWorkspaceAppResource[],
    blockers: value.blockers as Array<{ code: string; detail: string }>,
  });
}

function isWorkspaceAppResource(
  value: unknown,
): value is IWorkspaceAppResource {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(value.name) ||
    typeof value.description !== "string" ||
    value.description.length > 50
  )
    return false;
  if (isRecord(value.postgres) && Object.keys(value).length === 3) {
    return (
      /^vdab-pg-[a-f0-9]{16}$/.test(value.name) &&
      typeof value.postgres.database === "string" &&
      /^projects\/[A-Za-z0-9_-]{1,128}\/branches\/[A-Za-z0-9_-]{1,128}\/databases\/[A-Za-z0-9_-]{1,128}$/.test(
        value.postgres.database,
      ) &&
      value.postgres.permission === "CAN_CONNECT_AND_CREATE"
    );
  }
  if (isRecord(value.database) && Object.keys(value).length === 3) {
    return (
      /^vdab-db-[a-f0-9]{16}$/.test(value.name) &&
      typeof value.database.instance_name === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(value.database.instance_name) &&
      typeof value.database.database_name === "string" &&
      /^[A-Za-z0-9_$-]{1,63}$/.test(value.database.database_name) &&
      value.database.permission === "CAN_CONNECT_AND_CREATE"
    );
  }
  if (isRecord(value.sql_warehouse) && Object.keys(value).length === 3) {
    return (
      /^vdab-wh-[a-f0-9]{16}$/.test(value.name) &&
      typeof value.sql_warehouse.id === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(value.sql_warehouse.id) &&
      value.sql_warehouse.permission === "CAN_USE"
    );
  }
  if (isRecord(value.secret) && Object.keys(value).length === 3) {
    return (
      isWorkspaceSecretAppResource(value) && value.secret.permission === "READ"
    );
  }
  return false;
}

function isWorkspaceSecretAppResource(
  value: unknown,
): value is IWorkspaceSecretAppResource {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    typeof value.name !== "string" ||
    !/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(value.name) ||
    typeof value.description !== "string" ||
    value.description.length > 50 ||
    !isRecord(value.secret) ||
    Object.keys(value.secret).length !== 3 ||
    !isBoundedSecretIdentifier(value.secret.scope) ||
    !isBoundedSecretIdentifier(value.secret.key) ||
    (value.secret.permission !== "READ" &&
      value.secret.permission !== "WRITE" &&
      value.secret.permission !== "MANAGE")
  ) {
    return false;
  }
  return true;
}

function isBoundedSecretIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SECRET_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !containsControlCharacter(value)
  );
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= ASCII_CONTROL_CHARACTER_MAX ||
        codePoint === DELETE_CONTROL_CHARACTER)
    ) {
      return true;
    }
  }
  return false;
}

/** Creates or replaces the linked child App with the current saved project source. */
export async function startProjectDeployment(input: {
  projectId: string;
  mode: ProjectChildAppMode;
  appName: string;
  confirmOverwrite: boolean;
  secretResources?: IWorkspaceSecretResourceSelection[];
}): Promise<IProjectDeploymentSummary> {
  const response = await fetch(`${projectPath(input.projectId)}/deployments`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      mode: input.mode,
      appName: input.appName,
      confirmOverwrite: input.confirmOverwrite,
      secretResources: input.secretResources ?? [],
    }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseDeploymentSummary(await response.json());
}

/** Reads safe current deployment details before the user links or replaces an App. */
export async function getWorkspaceAppDeploymentTarget(
  appName: string,
  signal?: AbortSignal,
): Promise<IWorkspaceAppDeploymentTarget | null> {
  const response = await fetch(
    `${WORKSPACE_APPS_PATH}/${encodeURIComponent(appName)}/deployment-target`,
    {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    },
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const value: unknown = await response.json();
  return value === null ? null : parseWorkspaceAppDeploymentTarget(value);
}

/** Refreshes a deployment state through the installed workspace's Apps API. */
export async function getProjectDeployment(
  projectId: string,
  deploymentId: string,
  signal?: AbortSignal,
): Promise<IProjectDeploymentSummary> {
  const response = await fetch(
    `${projectPath(projectId)}/deployments/${encodeURIComponent(deploymentId)}`,
    {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    },
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseDeploymentSummary(await response.json());
}

/** Retries a failed deployment from its immutable saved source snapshot. */
export async function retryProjectDeployment(input: {
  projectId: string;
  deploymentId: string;
}): Promise<IProjectDeploymentSummary> {
  return runRecovery(input, "retry");
}

/** Rolls back by deploying a selected successful source snapshot. */
export async function rollbackProjectDeployment(input: {
  projectId: string;
  deploymentId: string;
}): Promise<IProjectDeploymentSummary> {
  return runRecovery(input, "rollback");
}

async function runRecovery(
  input: { projectId: string; deploymentId: string },
  operation: "retry" | "rollback",
): Promise<IProjectDeploymentSummary> {
  const response = await fetch(
    `${projectPath(input.projectId)}/deployments/${encodeURIComponent(input.deploymentId)}/${operation}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ confirmOverwrite: true }),
    },
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseDeploymentSummary(await response.json());
}

function projectPath(projectId: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(projectId)}`;
}

function parseDeploymentHistory(value: unknown): IProjectDeploymentHistory {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error(
      "The deployment service returned an invalid history response.",
    );
  }
  return new ProjectDeploymentHistory({
    childApp:
      value.childApp === null ? null : parseChildAppLink(value.childApp),
    items: value.items.map(parseDeploymentSummary),
  });
}

function parseChildAppLink(value: unknown) {
  if (
    !isRecord(value) ||
    !isNullableString(value.appId) ||
    typeof value.appName !== "string" ||
    !isChildAppMode(value.mode) ||
    !isNullableString(value.sourceCodePath)
  ) {
    throw new Error("The deployment service returned an invalid linked App.");
  }
  return {
    appId: value.appId,
    appName: value.appName,
    mode: value.mode,
    sourceCodePath: value.sourceCodePath,
  };
}

function parseDeploymentSummary(value: unknown): IProjectDeploymentSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.projectId !== "string" ||
    typeof value.appName !== "string" ||
    !isChildAppMode(value.mode) ||
    !Number.isSafeInteger(value.sourceVersion) ||
    !isDeploymentStatus(value.status) ||
    !isNullableString(value.deploymentId) ||
    !isNullableString(value.sourceCodePath) ||
    !isNullableString(value.failureCode) ||
    !isNullableString(value.attemptOf) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !isNullableString(value.completedAt) ||
    (value.completedAt !== null &&
      !Number.isFinite(Date.parse(value.completedAt)))
  ) {
    throw new Error(
      "The deployment service returned an invalid deployment record.",
    );
  }
  return new ProjectDeploymentSummary({
    id: value.id,
    projectId: value.projectId,
    appName: value.appName,
    mode: value.mode,
    sourceVersion: value.sourceVersion as number,
    status: value.status,
    deploymentId: value.deploymentId,
    sourceCodePath: value.sourceCodePath,
    failureCode: value.failureCode,
    attemptOf: value.attemptOf,
    createdAt: value.createdAt,
    completedAt: value.completedAt,
  });
}

function parseWorkspaceAppDeploymentTarget(
  value: unknown,
): IWorkspaceAppDeploymentTarget {
  if (
    !isRecord(value) ||
    !isNullableString(value.appId) ||
    typeof value.name !== "string" ||
    !isNullableString(value.description) ||
    !isNullableString(value.spaceName) ||
    !isNullableStringArray(value.effectiveUserApiScopes) ||
    !isNullableString(value.appState) ||
    !isNullableString(value.computeState) ||
    !isNullableString(value.appUrl) ||
    !isNullableString(value.activeDeploymentId) ||
    !isNullableString(value.sourceCodePath) ||
    typeof value.usesGitSource !== "boolean" ||
    !Array.isArray(value.userApiScopes) ||
    value.userApiScopes.some((scope) => typeof scope !== "string") ||
    !Array.isArray(value.secretResources) ||
    !value.secretResources.every(isWorkspaceSecretAppResource)
  ) {
    throw new Error("The workspace returned invalid child App details.");
  }
  return new WorkspaceAppDeploymentTarget({
    appId: value.appId,
    name: value.name,
    description: value.description,
    spaceName: value.spaceName,
    effectiveUserApiScopes: value.effectiveUserApiScopes,
    appState: value.appState,
    computeState: value.computeState,
    appUrl: value.appUrl,
    activeDeploymentId: value.activeDeploymentId,
    sourceCodePath: value.sourceCodePath,
    usesGitSource: value.usesGitSource,
    userApiScopes: value.userApiScopes as string[],
    secretResources: value.secretResources as IWorkspaceSecretAppResource[],
  });
}

function isChildAppMode(value: unknown): value is ProjectChildAppMode {
  return value === "createNew" || value === "linkExisting";
}

function isDeploymentStatus(value: unknown): value is ProjectDeploymentStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableStringArray(value: unknown): value is string[] | null {
  return (
    value === null ||
    (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (isRecord(value) && typeof value.detail === "string")
      return value.detail;
    if (isRecord(value) && typeof value.title === "string") return value.title;
  } catch {
    // Use the HTTP status if the response does not contain an RFC 9457 body.
  }
  return `The child App operation failed (HTTP ${response.status}).`;
}
