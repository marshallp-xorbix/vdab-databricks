import {
  listWorkspaceLakebaseBranches,
  listWorkspaceLakebaseDatabases,
  listWorkspaceLakebaseEndpoints,
  listWorkspaceLakebaseProjects,
  listWorkspaceLakebaseTables,
} from "./workspaceLakebaseResourcesApi";
import type {
  LakebaseAutoscalingBranchOption,
  LakebaseAutoscalingEndpointOption,
  LakebaseAutoscalingProjectOption,
  LakebaseAutoscalingSelectorResponse,
} from "../providers/DatabricksDataConnectorApi";

/** Builds the legacy selector shape from current-workspace Lakebase resources. */
export async function listWorkspaceLakebaseAutoscalingSelector(
  signal?: AbortSignal,
): Promise<LakebaseAutoscalingSelectorResponse> {
  const projectPage = await listWorkspaceLakebaseProjects(signal);
  const projects = await Promise.all(
    projectPage.items.map(async (project): Promise<LakebaseAutoscalingProjectOption> => {
      const branchPage = await listWorkspaceLakebaseBranches(project.projectId, signal);
      const branches: LakebaseAutoscalingBranchOption[] = branchPage.items.map((branch) => ({
        branchId: branch.branchId,
        branchName: branch.branchId,
        isDefault: branch.isDefault,
        endpoints: [],
      }));
      return {
        projectId: project.projectId,
        projectName: project.projectId,
        displayName: project.displayName,
        branches,
      };
    }),
  );
  return { projects };
}

/** Adds the selected branch's database and endpoint metadata for selector consumers. */
export async function getWorkspaceLakebaseBranchOptions(
  projectId: string,
  branch: LakebaseAutoscalingBranchOption,
  signal?: AbortSignal,
): Promise<LakebaseAutoscalingEndpointOption[]> {
  const [endpointPage, databasePage] = await Promise.all([
    listWorkspaceLakebaseEndpoints(projectId, branch.branchId, signal),
    listWorkspaceLakebaseDatabases(projectId, branch.branchId, signal),
  ]);
  const metadataEndpoint = endpointPage.items.find(
    (endpoint) => endpoint.endpointType === "read-write" && endpoint.state !== "degraded",
  );
  if (!metadataEndpoint) {
    return [];
  }
  return databasePage.items.map((database) => ({
    endpointId: database.databaseId,
    endpointName: database.databaseName,
    endpointType: "DATABASE_RESOURCE",
    postgresDatabaseName: database.databaseName,
    appsDatabaseResourceId: database.databaseId,
    metadataEndpointId: metadataEndpoint.endpointId,
  }));
}

/** Resolves the selected database resource to the branch's read-write metadata endpoint. */
export async function resolveWorkspaceLakebaseMetadataSelection(
  projectId: string,
  branchId: string,
  databaseResourceId: string,
  signal?: AbortSignal,
): Promise<{ endpointId: string; databaseName: string } | null> {
  const [endpointPage, databasePage] = await Promise.all([
    listWorkspaceLakebaseEndpoints(projectId, branchId, signal),
    listWorkspaceLakebaseDatabases(projectId, branchId, signal),
  ]);
  const database = databasePage.items.find((item) => item.databaseId === databaseResourceId);
  const endpoint = endpointPage.items.find(
    (item) => item.endpointType === "read-write" && item.state !== "degraded",
  );
  return database && endpoint
    ? { endpointId: endpoint.endpointId, databaseName: database.databaseName }
    : null;
}

/** Resolves the read-write endpoint ID used for caller-scoped PostgreSQL metadata reads. */
export function getWorkspaceLakebaseMetadataEndpointId(
  branch: LakebaseAutoscalingBranchOption | undefined,
  databaseResourceId: string | undefined,
): string | undefined {
  const selectedDatabase = (databaseResourceId ?? "").trim();
  if (!branch || !selectedDatabase) {
    return undefined;
  }
  return branch.endpoints.find(
    (endpoint) => endpoint.appsDatabaseResourceId === selectedDatabase,
  )?.metadataEndpointId;
}

/** Lists PostgreSQL column metadata for one selected Lakebase table. */
export async function getWorkspaceLakebaseTableColumns(
  projectId: string,
  branchId: string,
  databaseName: string,
  schemaName: string,
  tableName: string,
  signal?: AbortSignal,
): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
  const endpoints = await listWorkspaceLakebaseEndpoints(projectId, branchId, signal);
  const metadataEndpoint = endpoints.items.find(
    (endpoint) => endpoint.endpointType === "read-write" && endpoint.state !== "degraded",
  );
  if (!metadataEndpoint) {
    return [];
  }
  const tables = await listWorkspaceLakebaseTables({
    projectId,
    branchId,
    endpointId: metadataEndpoint.endpointId,
    databaseName,
  }, schemaName, signal);
  return tables.items.find((table) => table.name === tableName)?.columns ?? [];
}
