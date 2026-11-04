import type { CallerIdentity, ProjectDeploymentSourceFile } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { readProjectWorkspacePath } from "./project-deployment-settings.ts";

const MAX_SOURCE_FILE_BYTES = 7_000_000;
const MAX_SOURCE_TOTAL_BYTES = 25_000_000;
const MAX_SOURCE_FILES = 50;
const DATABRICKS_TOKEN_PATTERN = /\bdapi[a-f0-9]{32}\b/i;
const BEARER_SECRET_PATTERN = /\bBearer\s+[A-Za-z0-9._~-]{20,}/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/i;
const SOURCE_ASSIGNMENT_SECRET_PATTERN = /\b(?:api[_-]?key|client[_-]?secret|password)\s*=\s*(['"])(?:(?!\1)[^\r\n]){12,}\1/i;

/** Creates the immutable workspace folder for one caller-owned deployment attempt. */
export function createDeploymentSourcePath(
  caller: CallerIdentity,
  projectId: string,
  deploymentId: string,
  workspacePath?: string | null,
): string {
  if (workspacePath) {
    const basePath = readProjectWorkspacePath(workspacePath);
    if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(deploymentId)) throw invalidSourceBundle();
    const path = `${basePath}/.vdab/deployments/${projectId}/${deploymentId}`;
    validateDeploymentSourcePath(path);
    return path;
  }
  const userName = caller.email ?? caller.preferredUsername;
  if (!userName || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(userName)) {
    throw new ApplicationError(
      422,
      "deployment_source_identity_unavailable",
      "Workspace source folder cannot be created",
      "Databricks did not provide a usable current-user workspace identity for the generated source folder.",
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(deploymentId)) {
    throw invalidSourceBundle();
  }
  const path = `/Workspace/Users/${userName}/.vdab/deployments/${projectId}/${deploymentId}`;
  validateDeploymentSourcePath(path);
  return path;
}

/** Rejects secret-like generated files before storing or uploading a snapshot. */
export function validateGeneratedSource(
  sourceCodePath: string,
  files: ProjectDeploymentSourceFile[],
): void {
  validateDeploymentSourcePath(sourceCodePath);
  if (files.length === 0 || files.length > MAX_SOURCE_FILES) throw invalidSourceBundle();
  let totalBytes = 0;
  const paths = new Set<string>();
  for (const file of files) {
    const fileBytes = Buffer.byteLength(file.content, "utf8");
    totalBytes += fileBytes;
    if (
      !file.path ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      file.path.split("/").some((part) => part === "" || part === "." || part === "..") ||
      !/^[A-Za-z0-9._/-]+$/.test(file.path) ||
      paths.has(file.path) ||
      fileBytes > MAX_SOURCE_FILE_BYTES ||
      DATABRICKS_TOKEN_PATTERN.test(file.content) ||
      BEARER_SECRET_PATTERN.test(file.content) ||
      PRIVATE_KEY_PATTERN.test(file.content) ||
      SOURCE_ASSIGNMENT_SECRET_PATTERN.test(file.content)
    ) {
      throw invalidSourceBundle();
    }
    paths.add(file.path);
  }
  if (totalBytes > MAX_SOURCE_TOTAL_BYTES || !paths.has("app.py")) {
    throw invalidSourceBundle();
  }
}

/** Restricts snapshots to a controlled deployment subfolder in the workspace. */
export function validateDeploymentSourcePath(sourceCodePath: string): void {
  if (
    !sourceCodePath.startsWith("/Workspace/") ||
    !sourceCodePath.includes("/.vdab/deployments/") ||
    sourceCodePath.split("/").slice(1).some((part) => !part || part === "." || part === "..") ||
    /[\\\u0000-\u001f\u007f?#%]/.test(sourceCodePath)
  ) {
    throw new ApplicationError(
      400,
      "invalid_deployment_source_path",
      "Invalid deployment source path",
      "Generated app source must be stored in VDAB's controlled per-user deployment folder.",
    );
  }
}

function invalidSourceBundle(): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_generated_source",
    "Generated source cannot be deployed",
    "The generated source tree is invalid, contains a secret-like value, or exceeds the supported size limits.",
  );
}
