import {
  Project,
  ProjectList,
  type IProject,
  type IProjectList,
  type ProjectRole,
} from "../models/Project";
import {
  StandaloneProjectExport,
  type IPortableResourceReference,
  type IProjectImportResult,
  type IStandaloneProjectExport,
} from "../models/ProjectPortability";

const PROJECTS_PATH = "/api/v1/projects";

/** Lists projects visible to the current user in the installed workspace. */
export async function listProjects(
  signal?: AbortSignal,
): Promise<IProjectList> {
  const response = await fetch(PROJECTS_PATH, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProjectList(await response.json());
}

/** Creates a project in the workspace hosting VDAB. */
export async function createProject(input: {
  name: string;
  description: string | null;
}): Promise<IProject> {
  const response = await fetch(PROJECTS_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProject(await response.json());
}

/** Loads a project through the server's project ACL. */
export async function getProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProject> {
  const response = await fetch(projectPath(projectId), {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProject(await response.json());
}

/** Saves editable project metadata using optimistic version checking. */
export async function updateProject(input: {
  id: string;
  name: string;
  description: string | null;
  version: number;
  theme?: Record<string, unknown> | null;
}): Promise<IProject> {
  const response = await fetch(projectPath(input.id), {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      version: input.version,
      ...(input.theme === undefined ? {} : { theme: input.theme }),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProject(await response.json());
}

/** Removes a project from the current user's active project list. */
export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(projectPath(projectId), {
    method: "DELETE",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

/** Downloads one ACL-authorized project in the standalone v1 file format. */
export async function exportProject(
  projectId: string,
): Promise<IStandaloneProjectExport> {
  const response = await fetch(`${projectPath(projectId)}/export`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseProjectExport(await response.json());
}

/** Imports a standalone v1 project into the workspace hosting this VDAB. */
export async function importProject(
  value: unknown,
): Promise<IProjectImportResult> {
  const response = await fetch(`${PROJECTS_PATH}/import`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parseProjectImportResult(await response.json());
}

function projectPath(projectId: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(projectId)}`;
}

function parseProjectList(value: unknown): IProjectList {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("The project service returned an invalid response.");
  }

  return new ProjectList({ items: value.items.map(parseProject) });
}

function parseProject(value: unknown): IProject {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isNullableString(value.description) ||
    !Number.isSafeInteger(value.version) ||
    typeof value.createdBy !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isProjectRole(value.callerRole)
  ) {
    throw new Error("The project service returned an invalid project.");
  }

  return new Project({
    id: value.id,
    name: value.name,
    description: value.description,
    ...(isTheme(value.theme) ? { theme: value.theme } : {}),
    version: value.version as number,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    callerRole: value.callerRole,
  });
}

function isTheme(value: unknown): value is Record<string, unknown> | null {
  return value === null || (isRecord(value) && !Array.isArray(value));
}

function parseProjectExport(value: unknown): IStandaloneProjectExport {
  if (
    !isRecord(value) ||
    value.format !== "vdab-project" ||
    value.schemaVersion !== 1 ||
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isRecord(value.project)
  ) {
    throw new Error("The project export service returned an invalid document.");
  }
  return new StandaloneProjectExport({
    format: "vdab-project",
    schemaVersion: 1,
    exportedAt: value.exportedAt,
    project: value.project,
  });
}

function parseProjectImportResult(value: unknown): IProjectImportResult {
  if (
    !isRecord(value) ||
    value.requiresChildAppSelection !== true ||
    !Array.isArray(value.unresolvedResources)
  ) {
    throw new Error("The project import service returned an invalid result.");
  }
  return {
    project: parseProject(value.project),
    unresolvedResources: value.unresolvedResources.map(
      parsePortableResourceReference,
    ),
    requiresChildAppSelection: true,
  };
}

function parsePortableResourceReference(
  value: unknown,
): IPortableResourceReference {
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.label !== "string"
  ) {
    throw new Error(
      "The project import service returned an invalid resource reference.",
    );
  }
  const componentKeys = readOptionalStringArray(value.componentKeys);
  const workflowNodeIds = readOptionalStringArray(value.workflowNodeIds);
  return {
    key: value.key,
    kind: value.kind,
    label: value.label,
    ...(componentKeys === undefined ? {} : { componentKeys }),
    ...(workflowNodeIds === undefined ? {} : { workflowNodeIds }),
  };
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(
      "The project import service returned invalid resource usage.",
    );
  }
  return value;
}

function isProjectRole(value: unknown): value is ProjectRole {
  return (
    value === "owner" ||
    value === "editor" ||
    value === "viewer" ||
    value === "installationAdmin"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
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
    // Use the HTTP status when the response is not a JSON problem document.
  }

  return `Could not save the project (HTTP ${response.status}).`;
}
