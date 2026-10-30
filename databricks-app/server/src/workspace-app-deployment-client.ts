import type {
  CallerIdentity,
  ProjectDeploymentSourceFile,
  WorkspaceAppDeploymentStatus,
  WorkspaceAppResource,
} from "./contracts.ts";
import { MAX_APPS_PER_WORKSPACE } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { createWorkspaceAppsClient } from "./workspace-apps-client.ts";
import { waitForWorkspaceAppCompute } from "./workspace-app-compute.ts";
import {
  MAX_WORKSPACE_JSON_RESPONSE_BYTES,
  discardHttpResponseBody,
  readBoundedJsonResponse,
} from "./bounded-json-response.ts";
import { validateGeneratedSource } from "./deployment-source-validation.ts";
import { validateWorkspaceAppResources } from "./workspace-app-resource-validation.ts";
import {
  appNameConflict,
  invalidDatabricksResponse,
  invalidDeploymentId,
  invalidSourceBundle,
  readDatabricksErrorCode,
} from "./workspace-app-deployment-client-errors.ts";
import {
  normalizeWorkspaceHost,
  validateAppName,
  validateDeploymentSourcePath,
  validateUserApiScopes,
} from "./workspace-app-deployment-validation.ts";
import {
  parseWorkspaceAppDeploymentResponse,
  parseWorkspaceAppResponse,
} from "./workspace-app-deployment-response.ts";

const APPS_PATH = "/api/2.0/apps";
const WORKSPACE_MKDIRS_PATH = "/api/2.0/workspace/mkdirs";
const WORKSPACE_IMPORT_PATH = "/api/2.0/workspace/import";
const MAX_APP_LIST_PAGES = 50;
const MAX_APP_PAGE_TOKEN_LENGTH = 2_048;
const REQUEST_TIMEOUT_MS = 30_000;

/** Small response model required to safely operate a selected child App. */
export interface WorkspaceAppDetails {
  appId: string | null;
  name: string;
  description: string | null;
  spaceName: string | null;
  effectiveUserApiScopes: string[] | null;
  appState: string | null;
  computeState: string | null;
  appUrl: string | null;
  activeDeploymentId: string | null;
  activeDeploymentState?: string | null;
  sourceCodePath: string | null;
  usesGitSource: boolean;
  userApiScopes: string[];
  resources: WorkspaceAppResource[];
  unsupportedResourceCount?: number;
}

/** Caller-authorized App and immutable source deployment operations. */
export interface WorkspaceAppDeploymentClient {
  getInstalledAppSpace(caller: CallerIdentity): Promise<string | null>;
  countApps(caller: CallerIdentity): Promise<number>;
  getApp(
    caller: CallerIdentity,
    appName: string,
  ): Promise<WorkspaceAppDetails | null>;
  updateAppResources(
    caller: CallerIdentity,
    appName: string,
    resources: WorkspaceAppResource[],
  ): Promise<void>;
  createApp(
    caller: CallerIdentity,
    appName: string,
    description: string,
    userApiScopes: string[],
    appResources: WorkspaceAppResource[],
    appSpaceName: string | null,
  ): Promise<WorkspaceAppDetails>;
  uploadSource(
    caller: CallerIdentity,
    sourceCodePath: string,
    files: ProjectDeploymentSourceFile[],
  ): Promise<void>;
  createDeployment(
    caller: CallerIdentity,
    appName: string,
    sourceCodePath: string,
  ): Promise<WorkspaceAppDeploymentStatus>;
  getDeployment(
    caller: CallerIdentity,
    appName: string,
    deploymentId: string,
  ): Promise<WorkspaceAppDeploymentStatus>;
}

interface ApiObject extends Record<string, unknown> {}

/** Creates a Databricks client whose host comes only from trusted app config. */
export function createWorkspaceAppDeploymentClient(
  workspaceHost: string,
  installedAppName: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceAppDeploymentClient {
  const host = normalizeWorkspaceHost(workspaceHost);
  validateAppName(installedAppName);

  return {
    getInstalledAppSpace: (caller) =>
      getInstalledAppSpace(caller, installedAppName, host, fetchImplementation),
    countApps: (caller) => countApps(caller, host, fetchImplementation),
    getApp: (caller, appName) =>
      getApp(caller, appName, host, fetchImplementation),
    updateAppResources: (caller, appName, resources) =>
      updateAppResources(caller, appName, resources, host, fetchImplementation),
    createApp: (
      caller,
      appName,
      description,
      userApiScopes,
      appResources,
      appSpaceName,
    ) =>
      createApp(
        caller,
        appName,
        description,
        userApiScopes,
        appResources,
        appSpaceName,
        host,
        fetchImplementation,
      ),
    uploadSource: (caller, sourceCodePath, files) =>
      uploadSource(caller, sourceCodePath, files, host, fetchImplementation),
    createDeployment: (caller, appName, sourceCodePath) =>
      createDeployment(
        caller,
        appName,
        sourceCodePath,
        host,
        fetchImplementation,
      ),
    getDeployment: (caller, appName, deploymentId) =>
      getDeployment(caller, appName, deploymentId, host, fetchImplementation),
  };
}

async function getInstalledAppSpace(
  caller: CallerIdentity,
  installedAppName: string,
  host: string,
  fetchImplementation: typeof fetch,
): Promise<string | null> {
  const installedApp = await getApp(
    caller,
    installedAppName,
    host,
    fetchImplementation,
  );
  if (!installedApp) {
    throw new ApplicationError(
      502,
      "installed_builder_app_unavailable",
      "Installed VDAB App unavailable",
      "Databricks did not return the installed VDAB App configuration needed to select the child App's workspace policy.",
    );
  }
  return installedApp.spaceName;
}

async function countApps(
  caller: CallerIdentity,
  host: string,
  fetchImplementation: typeof fetch,
): Promise<number> {
  let pageToken: string | null = null;
  let appCount = 0;
  const seenPageTokens = new Set<string>();

  for (let pageNumber = 0; pageNumber < MAX_APP_LIST_PAGES; pageNumber += 1) {
    const endpoint = new URL(APPS_PATH, host);
    endpoint.searchParams.set("page_size", String(MAX_APPS_PER_WORKSPACE));
    if (pageToken) endpoint.searchParams.set("page_token", pageToken);
    const response = await callDatabricks(
      caller,
      endpoint,
      "GET",
      undefined,
      fetchImplementation,
    );
    const page = await readResponse(response);
    if (!isRecord(page)) throw invalidDatabricksResponse();
    const apps = page.apps;
    if (
      !Array.isArray(apps) ||
      apps.some(
        (app: unknown) => !isRecord(app) || typeof app.name !== "string",
      )
    ) {
      throw invalidDatabricksResponse();
    }
    appCount += apps.length;

    const nextPageToken = page.next_page_token;
    if (
      nextPageToken === undefined ||
      nextPageToken === null ||
      nextPageToken === ""
    ) {
      return appCount;
    }
    if (
      typeof nextPageToken !== "string" ||
      nextPageToken.length > MAX_APP_PAGE_TOKEN_LENGTH ||
      seenPageTokens.has(nextPageToken)
    ) {
      throw invalidDatabricksResponse();
    }
    seenPageTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }
  throw invalidDatabricksResponse();
}

async function getApp(
  caller: CallerIdentity,
  appName: string,
  host: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceAppDetails | null> {
  validateAppName(appName);
  const response = await callDatabricks(
    caller,
    new URL(`${APPS_PATH}/${encodeURIComponent(appName)}`, host),
    "GET",
    undefined,
    fetchImplementation,
    [404],
  );
  if (response.status === 404) {
    await discardHttpResponseBody(response);
    return null;
  }
  return parseWorkspaceAppResponse(await readResponse(response));
}

async function updateAppResources(
  caller: CallerIdentity,
  appName: string,
  resources: WorkspaceAppResource[],
  host: string,
  fetchImplementation: typeof fetch,
): Promise<void> {
  validateAppName(appName);
  const response = await callDatabricks(
    caller,
    new URL(`${APPS_PATH}/${encodeURIComponent(appName)}/update`, host),
    "POST",
    {
      app: {
        name: appName,
        resources: validateWorkspaceAppResources(resources),
      },
      update_mask: "resources",
    },
    fetchImplementation,
  );
  await discardHttpResponseBody(response);
}

async function createApp(
  caller: CallerIdentity,
  appName: string,
  description: string,
  userApiScopes: string[],
  appResources: WorkspaceAppResource[],
  appSpaceName: string | null,
  host: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceAppDetails> {
  validateAppName(appName);
  if (appSpaceName !== null) validateAppName(appSpaceName);
  const endpoint = new URL(APPS_PATH, host);
  endpoint.searchParams.set("no_compute", "true");
  const response = await callDatabricks(
    caller,
    endpoint,
    "POST",
    {
      name: appName,
      description,
      user_api_scopes: validateUserApiScopes(userApiScopes),
      ...(appSpaceName !== null ? { space: appSpaceName } : {}),
      ...(appResources.length > 0
        ? { resources: validateWorkspaceAppResources(appResources) }
        : {}),
    },
    fetchImplementation,
    [409],
  );
  if (response.status === 409) {
    await discardHttpResponseBody(response);
    throw appNameConflict();
  }
  return parseWorkspaceAppResponse(await readResponse(response));
}

async function uploadSource(
  caller: CallerIdentity,
  sourceCodePath: string,
  files: ProjectDeploymentSourceFile[],
  host: string,
  fetchImplementation: typeof fetch,
): Promise<void> {
  validateGeneratedSource(sourceCodePath, files);
  const directories = new Set([sourceCodePath, ...files
    .filter(file => file.path.includes("/"))
    .map(file => `${sourceCodePath}/${file.path.slice(0, file.path.lastIndexOf("/"))}`)]);
  for (const path of directories) {
    const directoryResponse = await callDatabricks(
      caller,
      new URL(WORKSPACE_MKDIRS_PATH, host),
      "POST",
      { path },
      fetchImplementation,
    );
    await discardHttpResponseBody(directoryResponse);
  }

  for (const file of files) {
    const endpoint = new URL(WORKSPACE_IMPORT_PATH, host);
    const importResponse = await callDatabricks(
      caller,
      endpoint,
      "POST",
      {
        format: "RAW",
        path: `${sourceCodePath}/${file.path}`,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        overwrite: false,
      },
      fetchImplementation,
    );
    await discardHttpResponseBody(importResponse);
  }
}

async function createDeployment(
  caller: CallerIdentity,
  appName: string,
  sourceCodePath: string,
  host: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceAppDeploymentStatus> {
  validateAppName(appName);
  validateDeploymentSourcePath(sourceCodePath);
  const lifecycleClient = createWorkspaceAppsClient(host, fetchImplementation);
  await waitForWorkspaceAppCompute(
    async () => {
      const app = await getApp(caller, appName, host, fetchImplementation);
      if (!app) throw invalidDatabricksResponse();
      return app;
    },
    () => lifecycleClient.startApp(caller, appName),
  );
  const response = await callDatabricks(
    caller,
    new URL(`${APPS_PATH}/${encodeURIComponent(appName)}/deployments`, host),
    "POST",
    { source_code_path: sourceCodePath, mode: "SNAPSHOT" },
    fetchImplementation,
  );
  return parseWorkspaceAppDeploymentResponse(await readResponse(response));
}

async function getDeployment(
  caller: CallerIdentity,
  appName: string,
  deploymentId: string,
  host: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceAppDeploymentStatus> {
  validateAppName(appName);
  if (!/^[A-Za-z0-9-]{8,80}$/.test(deploymentId)) {
    throw invalidDeploymentId();
  }
  const response = await callDatabricks(
    caller,
    new URL(
      `${APPS_PATH}/${encodeURIComponent(appName)}/deployments/${encodeURIComponent(deploymentId)}`,
      host,
    ),
    "GET",
    undefined,
    fetchImplementation,
  );
  return parseWorkspaceAppDeploymentResponse(await readResponse(response));
}

async function callDatabricks(
  caller: CallerIdentity,
  endpoint: URL,
  method: "GET" | "POST",
  body: ApiObject | undefined,
  fetchImplementation: typeof fetch,
  allowedStatusCodes: number[] = [],
): Promise<Response> {
  if (!caller.databricksAccessToken) {
    throw new ApplicationError(
      401,
      "databricks_session_required",
      "Sign in required",
      "Open this app through Databricks and sign in to continue.",
    );
  }

  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${caller.databricksAccessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApplicationError(
      502,
      "databricks_unavailable",
      "Databricks is unavailable",
      "The child App operation could not reach the installed workspace. Try again shortly.",
    );
  }

  if (response.ok || allowedStatusCodes.includes(response.status)) {
    return response;
  }
  const upstreamCode = await readDatabricksErrorCode(response);
  if (response.status === 401) {
    throw new ApplicationError(
      401,
      "databricks_auth_failed",
      "Databricks sign-in expired",
      "Refresh the app and sign in to Databricks again.",
    );
  }
  if (response.status === 403) {
    throw new ApplicationError(
      403,
      "databricks_deployment_access_denied",
      "Databricks permission required",
      "The builder App needs approved apps and workspace.workspace user scopes, user consent, source-folder access, and any required App Space CAN CREATE APP permission. The child App service principal also needs read access to the generated source folder. An administrator may enforce Git-only deployments.",
    );
  }
  if (response.status === 429) {
    throw new ApplicationError(
      429,
      "databricks_resource_exhausted",
      "Databricks limit reached",
      "Databricks reported an API rate limit or workspace resource quota. VDAB does not retry this write automatically. Check the workspace App limit and retry only after confirming the cause.",
    );
  }
  throw new ApplicationError(
    502,
    "databricks_deployment_request_failed",
    "Databricks request failed",
    `The child App operation failed (HTTP ${response.status}, ${upstreamCode}, ${endpoint.pathname.endsWith("/deployments") ? "deployment submission" : "workspace operation"}). Check workspace policy and try again.`,
  );
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await readBoundedJsonResponse(
      response,
      MAX_WORKSPACE_JSON_RESPONSE_BYTES,
    );
  } catch {
    // The common typed failure below intentionally excludes upstream content.
  }
  if (response.status === 404) return {};
  if (response.status === 409) throw appNameConflict();
  throw invalidDatabricksResponse();
}

function isRecord(value: unknown): value is ApiObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
