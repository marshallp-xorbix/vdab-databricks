import {
  ProjectCustomModulesDocument,
  type IProjectCustomModulesDocument,
} from "../models/ProjectCustomModules";

const PROJECTS_PATH = "/api/v1/projects";

/** Loads project custom Python source under the current project's ACL. */
export async function getProjectCustomModules(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProjectCustomModulesDocument> {
  const response = await fetch(`${projectPath(projectId)}/custom-modules`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseDocument(await response.json());
}

/** Replaces project custom Python source at the shared project version. */
export async function replaceProjectCustomModules(input: {
  projectId: string;
  version: number;
  source: string;
}): Promise<IProjectCustomModulesDocument> {
  const response = await fetch(`${projectPath(input.projectId)}/custom-modules`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ expectedVersion: input.version, source: input.source }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseDocument(await response.json());
}

function projectPath(projectId: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(projectId)}`;
}

function parseDocument(value: unknown): IProjectCustomModulesDocument {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    !isPositiveInteger(value.version) ||
    typeof value.source !== "string"
  ) {
    throw new Error("The project service returned an invalid custom modules document.");
  }
  return new ProjectCustomModulesDocument({
    projectId: value.projectId,
    version: value.version,
    source: value.source,
  });
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const responseBody: unknown = await response.json();
    if (isRecord(responseBody) && typeof responseBody.detail === "string") {
      return responseBody.detail;
    }
    if (isRecord(responseBody) && typeof responseBody.title === "string") {
      return responseBody.title;
    }
  } catch {
    // Use the status when the server response is not a problem document.
  }
  return `The custom modules request failed (HTTP ${response.status}).`;
}
