import {
  ProjectComponent,
  ProjectComponentsDocument,
  ProjectPreview,
  type IProjectComponent,
  type IProjectComponentsDocument,
  type IProjectPreview,
  type ProjectJsonObject,
  type ProjectJsonValue,
} from "../models/ProjectComponents";

const PROJECTS_PATH = "/api/v1/projects";

/** Loads the ordered component aggregate under the current user's project ACL. */
export async function getProjectComponents(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProjectComponentsDocument> {
  const response = await fetch(`${projectPath(projectId)}/components`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProjectComponents(await response.json());
}

/** Saves a full ordered component aggregate with optimistic version checking. */
export async function replaceProjectComponents(input: {
  projectId: string;
  version: number;
  components: IProjectComponent[];
}): Promise<IProjectComponentsDocument> {
  const response = await fetch(`${projectPath(input.projectId)}/components`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      version: input.version,
      components: input.components,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProjectComponents(await response.json());
}

/** Requests preview source for the latest persisted project version. */
export async function generateProjectPreview(
  projectId: string,
): Promise<IProjectPreview> {
  const response = await fetch(`${projectPath(projectId)}/preview`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseProjectPreview(await response.json());
}

function projectPath(projectId: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(projectId)}`;
}

function parseProjectComponents(value: unknown): IProjectComponentsDocument {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    !isPositiveInteger(value.version) ||
    !Array.isArray(value.components)
  ) {
    throw new Error("The project service returned an invalid component document.");
  }

  return new ProjectComponentsDocument({
    projectId: value.projectId,
    version: value.version,
    components: value.components.map(parseProjectComponent),
  });
}

function parseProjectComponent(value: unknown): IProjectComponent {
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    typeof value.type !== "string" ||
    !isPositiveInteger(value.schemaVersion) ||
    !isPositiveInteger(value.componentVersion) ||
    !isNullableString(value.codeName) ||
    !isNullableString(value.description) ||
    !isJsonObject(value.properties) ||
    !(value.bindings === null || isJsonObject(value.bindings)) ||
    !Array.isArray(value.children) ||
    !value.children.every((child) => typeof child === "string") ||
    !(value.layout === null || isJsonObject(value.layout))
  ) {
    throw new Error("The project service returned an invalid component.");
  }

  return new ProjectComponent({
    key: value.key,
    type: value.type,
    schemaVersion: value.schemaVersion,
    componentVersion: value.componentVersion,
    codeName: value.codeName,
    description: value.description,
    properties: value.properties,
    bindings: value.bindings,
    children: value.children,
    layout: value.layout,
  });
}

function parseProjectPreview(value: unknown): IProjectPreview {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    !isPositiveInteger(value.version) ||
    value.previewOnly !== true ||
    !Array.isArray(value.files) ||
    !value.files.every(
      (file) =>
        isRecord(file) &&
        typeof file.path === "string" &&
        typeof file.content === "string",
    )
  ) {
    throw new Error("The project service returned an invalid preview.");
  }

  return new ProjectPreview({
    projectId: value.projectId,
    version: value.version,
    previewOnly: true,
    files: value.files,
  });
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isJsonObject(value: unknown): value is ProjectJsonObject {
  return isRecord(value) &&
    Object.values(value).every((property) => isJsonValue(property));
}

function isJsonValue(value: unknown): value is ProjectJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }

  return isJsonObject(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
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
    // Use the HTTP status when the response is not a JSON problem document.
  }

  return `The project request failed (HTTP ${response.status}).`;
}
