import type {
  CallerIdentity,
  WorkspaceLakebaseBranchResource,
  WorkspaceLakebaseDatabaseResource,
  WorkspaceLakebaseEndpointResource,
  WorkspaceLakebaseProjectResource,
  WorkspaceLakebaseTableResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import { createPostgresConnection } from "./workspace-lakebase-postgres-connection.ts";
import type { LakebasePostgresConnectionFactory } from "./workspace-lakebase-postgres-connection.ts";
import {
  POSTGRES_API_PATH,
  PROJECTS_PATH,
  branchPath,
  encodeResourceId,
  listApiRecords,
} from "./workspace-lakebase-api-client.ts";
import {
  invalidLakebaseRequest,
  readBranch,
  readDatabase,
  readEndpoint,
  readProject,
  sortByLabel,
} from "./workspace-lakebase-resource-readers.ts";
import {
  listLakebaseSchemas as listSchemas,
  listLakebaseTables as listTables,
} from "./workspace-lakebase-metadata-client.ts";

export type {
  LakebasePostgresConnection,
  LakebasePostgresConnectionFactory,
  LakebasePostgresConnectionOptions,
} from "./workspace-lakebase-postgres-connection.ts";

export interface WorkspaceLakebaseResourcesClient {
  listProjects(caller: CallerIdentity, signal?: AbortSignal): Promise<WorkspaceLakebaseProjectResource[]>;
  listBranches(
    caller: CallerIdentity,
    projectId: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseBranchResource[]>;
  listEndpoints(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceLakebaseEndpointResource[]>;
  listDatabases(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
  ): Promise<WorkspaceLakebaseDatabaseResource[]>;
  listSchemas(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
  ): Promise<string[]>;
  listTables(
    caller: CallerIdentity,
    projectId: string,
    branchId: string,
    endpointId: string,
    databaseName: string,
    schemaName: string,
  ): Promise<WorkspaceLakebaseTableResource[]>;
}
export function createWorkspaceLakebaseResourcesClient(
  workspaceHost: string,
  fetchImplementation: typeof fetch = fetch,
  connectionFactory: LakebasePostgresConnectionFactory = createPostgresConnection,
): WorkspaceLakebaseResourcesClient {
  const pinnedWorkspaceHost = normalizeWorkspaceHost(workspaceHost);

  return {
    listProjects: async (caller, signal) => listProjects(caller, pinnedWorkspaceHost, fetchImplementation, signal),
    listBranches: async (caller, projectId, signal) => listBranches(
      caller,
      projectId,
      pinnedWorkspaceHost,
      fetchImplementation,
      signal,
    ),
    listEndpoints: async (caller, projectId, branchId, signal) => listEndpoints(
      caller,
      projectId,
      branchId,
      pinnedWorkspaceHost,
      fetchImplementation,
      signal,
    ),
    listDatabases: async (caller, projectId, branchId) => listDatabases(
      caller,
      projectId,
      branchId,
      pinnedWorkspaceHost,
      fetchImplementation,
    ),
    listSchemas: async (caller, projectId, branchId, endpointId, databaseName) =>
      listSchemas(
        caller,
        projectId,
        branchId,
        endpointId,
        databaseName,
        pinnedWorkspaceHost,
        fetchImplementation,
        connectionFactory,
      ),
    listTables: async (
      caller,
      projectId,
      branchId,
      endpointId,
      databaseName,
      schemaName,
    ) => listTables(
      caller,
      projectId,
      branchId,
      endpointId,
      databaseName,
      schemaName,
      pinnedWorkspaceHost,
      fetchImplementation,
      connectionFactory,
    ),
  };
}
async function listProjects(
  caller: CallerIdentity,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseProjectResource[]> {
  const records = await listApiRecords(
    caller,
    PROJECTS_PATH,
    "projects",
    workspaceHost,
    fetchImplementation,
    signal,
  );
  return sortByLabel(records.map(readProject));
}
async function listBranches(
  caller: CallerIdentity,
  projectId: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseBranchResource[]> {
  const path = `${PROJECTS_PATH}/${encodeResourceId(projectId)}/branches`;
  const records = await listApiRecords(caller, path, "branches", workspaceHost, fetchImplementation, signal);
  return records.map(readBranch).sort((left, right) => left.branchId.localeCompare(right.branchId));
}
async function listEndpoints(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<WorkspaceLakebaseEndpointResource[]> {
  const path = `${branchPath(projectId, branchId)}/endpoints`;
  const records = await listApiRecords(caller, path, "endpoints", workspaceHost, fetchImplementation, signal);
  return records.map(readEndpoint).sort((left, right) => left.endpointId.localeCompare(right.endpointId));
}
async function listDatabases(
  caller: CallerIdentity,
  projectId: string,
  branchId: string,
  workspaceHost: string,
  fetchImplementation: typeof fetch,
): Promise<WorkspaceLakebaseDatabaseResource[]> {
  const path = `${branchPath(projectId, branchId)}/databases`;
  const records = await listApiRecords(caller, path, "databases", workspaceHost, fetchImplementation);
  return records.map(readDatabase).sort((left, right) => left.databaseName.localeCompare(right.databaseName));
}
function normalizeWorkspaceHost(workspaceHost: string): string {
  const parsedHost = new URL(workspaceHost);
  if (
    parsedHost.protocol !== "https:" ||
    parsedHost.username.length > 0 ||
    parsedHost.password.length > 0 ||
    parsedHost.pathname !== "/" ||
    parsedHost.search.length > 0 ||
    parsedHost.hash.length > 0
  ) {
    throw new Error("DATABRICKS_HOST must be an HTTPS workspace origin.");
  }
  return parsedHost.origin;
}
