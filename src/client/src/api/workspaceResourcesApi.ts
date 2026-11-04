import {
  WorkspaceResourcesPage,
  type IWorkspaceResourcesPage,
} from "../models/WorkspaceResource";
import {
  WorkspaceTablesPage,
  type IWorkspaceTablesPage,
} from "../models/WorkspaceTable";
import {
  WorkspaceGenieSpacesPage,
  type IWorkspaceGenieSpacesPage,
} from "../models/WorkspaceGenieSpace";
import {
  WorkspaceServingEndpointsPage,
  type IWorkspaceServingEndpoint,
  type IWorkspaceServingEndpointsPage,
} from "../models/WorkspaceServingEndpoint";

const WORKSPACE_RESOURCES_PATH = "/api/v1/workspace/resources";

/** Lists catalogs visible to the signed-in user in the installed workspace. */
export async function listWorkspaceCatalogs(
  signal?: AbortSignal,
): Promise<IWorkspaceResourcesPage> {
  return readWorkspaceResources(
    `${WORKSPACE_RESOURCES_PATH}/catalogs`,
    signal,
  );
}

/** Lists schemas visible to the signed-in user in one catalog. */
export async function listWorkspaceSchemas(
  catalogName: string,
  signal?: AbortSignal,
): Promise<IWorkspaceResourcesPage> {
  const query = new URLSearchParams({ catalogName });
  return readWorkspaceResources(
    `${WORKSPACE_RESOURCES_PATH}/schemas?${query.toString()}`,
    signal,
  );
}

/** Lists volumes visible to the signed-in user in one catalog and schema. */
export async function listWorkspaceVolumes(
  catalogName: string,
  schemaName: string,
  signal?: AbortSignal,
): Promise<IWorkspaceResourcesPage> {
  const query = new URLSearchParams({ catalogName, schemaName });
  return readWorkspaceResources(
    `${WORKSPACE_RESOURCES_PATH}/volumes?${query.toString()}`,
    signal,
  );
}

/** Lists tables and column metadata visible to the user in one current schema. */
export async function listWorkspaceTables(
  catalogName: string,
  schemaName: string,
  signal?: AbortSignal,
): Promise<IWorkspaceTablesPage> {
  const query = new URLSearchParams({ catalogName, schemaName });
  const response = await fetch(
    `${WORKSPACE_RESOURCES_PATH}/tables?${query.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const responseBody: unknown = await response.json();
  return parseWorkspaceTablesPage(responseBody);
}

/** Lists Genie spaces visible to the signed-in user in the installed workspace. */
export async function listWorkspaceGenieSpaces(
  signal?: AbortSignal,
): Promise<IWorkspaceGenieSpacesPage> {
  const response = await fetch(`${WORKSPACE_RESOURCES_PATH}/genie-spaces`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const responseBody: unknown = await response.json();
  return parseWorkspaceGenieSpacesPage(responseBody);
}

/** Lists serving endpoints visible to the signed-in user in this workspace. */
export async function listWorkspaceServingEndpoints(
  signal?: AbortSignal,
): Promise<IWorkspaceServingEndpointsPage> {
  const response = await fetch(`${WORKSPACE_RESOURCES_PATH}/serving-endpoints`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const responseBody: unknown = await response.json();
  return parseWorkspaceServingEndpointsPage(responseBody);
}

async function readWorkspaceResources(
  path: string,
  signal?: AbortSignal,
): Promise<IWorkspaceResourcesPage> {
  const response = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const responseBody: unknown = await response.json();
  return parseWorkspaceResourcesPage(responseBody);
}

function parseWorkspaceResourcesPage(value: unknown): IWorkspaceResourcesPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("The workspace returned an invalid resource response.");
  }

  if (
    value.authenticationMode !== "databricks" &&
    value.authenticationMode !== "local-test"
  ) {
    throw new Error("The workspace returned an invalid resource response.");
  }

  return new WorkspaceResourcesPage({
    items: value.items.map(parseWorkspaceResource),
    authenticationMode: value.authenticationMode,
  });
}

function parseWorkspaceTablesPage(value: unknown): IWorkspaceTablesPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("The workspace returned an invalid table response.");
  }

  if (
    value.authenticationMode !== "databricks" &&
    value.authenticationMode !== "local-test"
  ) {
    throw new Error("The workspace returned an invalid table response.");
  }

  return new WorkspaceTablesPage({
    items: value.items.map(parseWorkspaceTable),
    authenticationMode: value.authenticationMode,
  });
}

function parseWorkspaceGenieSpacesPage(value: unknown): IWorkspaceGenieSpacesPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    (value.authenticationMode !== "databricks" &&
      value.authenticationMode !== "local-test")
  ) {
    throw new Error("The workspace returned an invalid Genie space response.");
  }

  const items = value.items.map((space) => {
    if (
      !isRecord(space) ||
      typeof space.spaceId !== "string" ||
      !/^(?:[A-Fa-f0-9]{32}|[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12})$/.test(space.spaceId) ||
      typeof space.title !== "string" ||
      space.title.trim() !== space.title ||
      space.title.length < 1 ||
      space.title.length > 512 ||
      containsControlCharacters(space.title)
    ) {
      throw new Error("The workspace returned an invalid Genie space.");
    }
    return { spaceId: space.spaceId, title: space.title };
  });

  return new WorkspaceGenieSpacesPage({
    items,
    authenticationMode: value.authenticationMode,
  });
}

function parseWorkspaceServingEndpointsPage(
  value: unknown,
): IWorkspaceServingEndpointsPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    (value.authenticationMode !== "databricks" &&
      value.authenticationMode !== "local-test")
  ) {
    throw new Error("The workspace returned an invalid serving endpoint response.");
  }

  const items = value.items.map((endpoint): IWorkspaceServingEndpoint => {
    if (
      !isRecord(endpoint) ||
      typeof endpoint.name !== "string" ||
      !/^[A-Za-z0-9_-]{1,63}$/.test(endpoint.name) ||
      (endpoint.readiness !== "ready" &&
        endpoint.readiness !== "not-ready" &&
        endpoint.readiness !== "unknown") ||
      (endpoint.permissionLevel !== null &&
        endpoint.permissionLevel !== "CAN_VIEW" &&
        endpoint.permissionLevel !== "CAN_QUERY" &&
        endpoint.permissionLevel !== "CAN_MANAGE")
    ) {
      throw new Error("The workspace returned an invalid serving endpoint.");
    }
    return {
      name: endpoint.name,
      readiness: endpoint.readiness,
      permissionLevel: endpoint.permissionLevel,
      ...(typeof endpoint.task === "string" ? { task: endpoint.task } : {}),
    };
  });

  return new WorkspaceServingEndpointsPage({
    items,
    authenticationMode: value.authenticationMode,
  });
}

function parseWorkspaceTable(value: unknown): {
  name: string;
  dataSourceFormat: string | null;
  columns: Array<{ name: string; type: string | null; dataType: string | null }>;
} {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    value.name === "" ||
    !Array.isArray(value.columns) ||
    (value.dataSourceFormat !== undefined &&
      value.dataSourceFormat !== null &&
      typeof value.dataSourceFormat !== "string")
  ) {
    throw new Error("The workspace returned an invalid table.");
  }

  const columns = value.columns.map((column) => {
    if (
      !isRecord(column) ||
      typeof column.name !== "string" ||
      column.name === "" ||
      (column.type !== null && typeof column.type !== "string") ||
      (column.dataType !== undefined &&
        column.dataType !== null &&
        typeof column.dataType !== "string")
    ) {
      throw new Error("The workspace returned invalid table column metadata.");
    }

    return {
      name: column.name,
      type: column.type,
      dataType: typeof column.dataType === "string" ? column.dataType : null,
    };
  });

  return {
    name: value.name,
    dataSourceFormat:
      typeof value.dataSourceFormat === "string" ? value.dataSourceFormat : null,
    columns,
  };
}

function containsControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint < 32 || codePoint === 127;
  });
}

function parseWorkspaceResource(value: unknown): { name: string } {
  if (!isRecord(value) || typeof value.name !== "string" || value.name === "") {
    throw new Error("The workspace returned an invalid resource name.");
  }

  return { name: value.name };
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

  return `Could not load workspace resources (HTTP ${response.status}).`;
}
