import type {
  CallerIdentity,
  WorkspaceExperimentResource,
  WorkspaceSecretScopeResource,
} from "./contracts.ts";
import { MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH } from "./contracts.ts";
import {
  discardHttpResponseBody,
} from "./bounded-json-response.ts";
import {
  fetchWorkspaceResource,
  invalidWorkspaceResourceResponse,
  isRecord,
  normalizeWorkspaceHost,
  postWorkspaceResource,
  readWorkspaceResourceResponse,
} from "./workspace-resource-api.ts";

const SECRET_SCOPES_PATH = "/api/2.0/secrets/scopes/list";
const SECRET_KEYS_PATH = "/api/2.0/secrets/list";
const EXPERIMENTS_SEARCH_PATH = "/api/2.0/mlflow/experiments/search";
const EXPERIMENTS_LIST_PATH = "/api/2.0/mlflow/experiments/list";
const MAX_EXPERIMENTS = 500;
const MAX_SECRET_KEYS = 1_000;

/** Lists secret scopes/keys and MLflow experiments for App resource pickers. */
export interface WorkspaceSecretExperimentResourcesClient {
  listSecretScopes(
    caller: CallerIdentity,
  ): Promise<WorkspaceSecretScopeResource[]>;
  listSecretKeys(
    caller: CallerIdentity,
    secretScope: string,
  ): Promise<WorkspaceSecretScopeResource[]>;
  listExperiments(
    caller: CallerIdentity,
  ): Promise<WorkspaceExperimentResource[]>;
}

/** Creates a caller-authorized secret and experiment discovery client. */
export function createWorkspaceSecretExperimentResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
): WorkspaceSecretExperimentResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);
  return {
    listSecretScopes: (caller) =>
      listSecretScopes(caller, pinnedWorkspaceHost, fetchImplementation),
    listSecretKeys: (caller, secretScope) =>
      listSecretKeys(
        caller,
        secretScope,
        pinnedWorkspaceHost,
        fetchImplementation,
      ),
    listExperiments: (caller) =>
      listExperiments(caller, pinnedWorkspaceHost, fetchImplementation),
  };
}

async function listSecretScopes(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceSecretScopeResource[]> {
  const response = await fetchWorkspaceResource(
    new URL(SECRET_SCOPES_PATH, workspaceHost),
    caller,
    fetchImplementation,
    "Confirm the secrets user authorization scope and your access to secret scopes.",
  );
  const body = await readWorkspaceResourceResponse(response);
  if (!Array.isArray(body.scopes)) throw invalidWorkspaceResourceResponse();
  const items = new Map<string, WorkspaceSecretScopeResource>();
  for (const value of body.scopes) {
    const name = readSecretIdentifier(
      isRecord(value) ? value.name : undefined,
    );
    items.set(name, { name });
  }
  return [...items.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function listSecretKeys(
  caller: CallerIdentity,
  secretScope: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceSecretScopeResource[]> {
  const scope = readSecretIdentifier(secretScope);
  const permissionDetail =
    "Confirm the secrets user authorization scope and your access to this secret scope.";
  let response = await postWorkspaceResource(
    new URL(SECRET_KEYS_PATH, workspaceHost),
    caller,
    fetchImplementation,
    { scope },
    permissionDetail,
    undefined,
    [404],
  );
  if (response.status === 404) {
    await discardHttpResponseBody(response);
    const endpoint = new URL(SECRET_KEYS_PATH, workspaceHost);
    endpoint.searchParams.set("scope", scope);
    response = await fetchWorkspaceResource(
      endpoint,
      caller,
      fetchImplementation,
      permissionDetail,
    );
  }
  const body = await readWorkspaceResourceResponse(response);
  if (!Array.isArray(body.secrets) || body.secrets.length > MAX_SECRET_KEYS) {
    throw invalidWorkspaceResourceResponse();
  }
  const items = new Map<string, WorkspaceSecretScopeResource>();
  for (const value of body.secrets) {
    const name = readSecretIdentifier(
      isRecord(value) ? value.key : undefined,
    );
    items.set(name, { name });
  }
  return [...items.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function listExperiments(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceExperimentResource[]> {
  const permissionDetail =
    "Confirm the MLflow user authorization scope and your access to experiments.";
  let response = await postWorkspaceResource(
    new URL(EXPERIMENTS_SEARCH_PATH, workspaceHost),
    caller,
    fetchImplementation,
    { max_results: MAX_EXPERIMENTS },
    permissionDetail,
    undefined,
    [404],
  );
  if (response.status === 404) {
    await discardHttpResponseBody(response);
    response = await postWorkspaceResource(
      new URL(EXPERIMENTS_LIST_PATH, workspaceHost),
      caller,
      fetchImplementation,
      { max_results: MAX_EXPERIMENTS },
      permissionDetail,
    );
  }
  const body = await readWorkspaceResourceResponse(response);
  if (
    !Array.isArray(body.experiments) ||
    body.experiments.length > MAX_EXPERIMENTS
  ) {
    throw invalidWorkspaceResourceResponse();
  }
  const items = new Map<string, WorkspaceExperimentResource>();
  for (const value of body.experiments) {
    const experiment = readExperiment(value);
    items.set(experiment.experimentId, experiment);
  }
  return [...items.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.experimentId.localeCompare(right.experimentId),
  );
}

function readSecretIdentifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidWorkspaceResourceResponse();
  }
  return value;
}

function readExperiment(value: unknown): WorkspaceExperimentResource {
  if (!isRecord(value)) throw invalidWorkspaceResourceResponse();
  if (
    typeof value.experiment_id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.experiment_id)
  ) {
    throw invalidWorkspaceResourceResponse();
  }
  const name =
    typeof value.name === "string" &&
    value.name.trim() !== "" &&
    value.name.length <= 512 &&
    value.name.trim() === value.name &&
    !/[\u0000-\u001f\u007f]/.test(value.name)
      ? value.name
      : value.experiment_id;
  return { experimentId: value.experiment_id, name };
}
