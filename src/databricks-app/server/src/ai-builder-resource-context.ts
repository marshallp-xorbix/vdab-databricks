import { ApplicationError } from "./application-error.ts";
import type {
  CallerIdentity,
  WorkspaceJobResource,
  WorkspaceLakebaseBranchResource,
  WorkspaceLakebaseEndpointResource,
  WorkspaceLakebaseProjectResource,
  WorkspaceSqlWarehouseResource,
} from "./contracts.ts";
import type { WorkspaceExecutionResourcesService } from "./workspace-execution-resources-service.ts";
import type { WorkspaceLakebaseResourcesService } from "./workspace-lakebase-resources-service.ts";
import type { WorkspaceResourcesService } from "./workspace-resources-service.ts";

const MAX_CATALOGS = 8;
const MAX_TABLES = 32;
const MAX_JOBS = 30;
const MAX_SQL_WAREHOUSES = 20;
const MAX_LAKEBASE_PROJECTS = 5;
const MAX_LAKEBASE_BRANCHES_PER_PROJECT = 3;
const MAX_LAKEBASE_ENDPOINTS_PER_BRANCH = 3;
const MAX_LAKEBASE_DISCOVERY_CONCURRENCY = 4;
const MAX_CONTEXT_BYTES = 16_000;

type DiscoveryStatus = "available" | "empty" | "partial" | "unavailable";
type DiscoveryFailureReason = "permission_required" | "temporarily_unavailable";

interface InventorySection<T> {
  status: DiscoveryStatus;
  items: T[];
  truncated?: boolean;
  reason?: DiscoveryFailureReason;
}

interface AiBuilderLakebaseBranch {
  branchId: string;
  endpoints: Array<Pick<WorkspaceLakebaseEndpointResource, "endpointId" | "endpointType" | "state">>;
}

interface AiBuilderLakebaseProject {
  projectId: string;
  displayName: string;
  branches: AiBuilderLakebaseBranch[];
}

/** Bounded, token-free inventory available to the current AI Builder caller. */
export interface AiBuilderResourceContext {
  unityCatalogTables: InventorySection<string>;
  jobs: InventorySection<WorkspaceJobResource>;
  sqlWarehouses: InventorySection<WorkspaceSqlWarehouseResource>;
  lakebaseAutoscaling: InventorySection<AiBuilderLakebaseProject>;
}

/** Builds advisory resource context using only caller-authorized workspace adapters. */
export class AiBuilderResourceContextService {
  private readonly workspaceResources: WorkspaceResourcesService;
  private readonly executionResources: WorkspaceExecutionResourcesService;
  private readonly lakebaseResources: WorkspaceLakebaseResourcesService;

  constructor(
    workspaceResources: WorkspaceResourcesService,
    executionResources: WorkspaceExecutionResourcesService,
    lakebaseResources: WorkspaceLakebaseResourcesService,
  ) {
    this.workspaceResources = workspaceResources;
    this.executionResources = executionResources;
    this.lakebaseResources = lakebaseResources;
  }

  /** Returns safe current-workspace names and IDs, never hosts or credentials. */
  async getContext(caller: CallerIdentity, signal: AbortSignal): Promise<AiBuilderResourceContext> {
    const [unityCatalogTables, jobs, sqlWarehouses, lakebaseAutoscaling] = await Promise.all([
      this.discoverUnityCatalogTables(caller, signal),
      this.discoverJobs(caller, signal),
      this.discoverSqlWarehouses(caller, signal),
      this.discoverLakebase(caller, signal),
    ]);
    signal.throwIfAborted();
    return fitContextByteLimit({ unityCatalogTables, jobs, sqlWarehouses, lakebaseAutoscaling });
  }

  private async discoverUnityCatalogTables(
    caller: CallerIdentity,
    signal: AbortSignal,
  ): Promise<InventorySection<string>> {
    let catalogs: string[];
    try {
      catalogs = (await this.workspaceResources.listCatalogs(caller, signal)).items
        .map((catalog) => catalog.name).sort();
    } catch (error) {
      return unavailableFor(error, signal);
    }
    if (catalogs.length === 0) return { status: "empty", items: [] };

    let truncated = catalogs.length > MAX_CATALOGS;
    let failureReason: DiscoveryFailureReason | undefined;
    const tables = new Set<string>();
    for (const catalogName of catalogs.slice(0, MAX_CATALOGS)) {
      signal.throwIfAborted();
      const remaining = MAX_TABLES - tables.size;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      try {
        const page = await this.workspaceResources.listTableSummaries(
          caller,
          catalogName,
          remaining,
          signal,
        );
        page.items.forEach((table) => tables.add(table.fullName));
        truncated ||= page.hasMore;
      } catch (error) {
        failureReason = mergeFailureReason(failureReason, readFailureReason(error, signal));
      }
    }
    const items = [...tables].sort().slice(0, MAX_TABLES);
    return createSection(items, truncated, failureReason);
  }

  private async discoverJobs(
    caller: CallerIdentity,
    signal: AbortSignal,
  ): Promise<InventorySection<WorkspaceJobResource>> {
    try {
      const jobs = (await this.executionResources.listJobs(caller, signal)).items;
      return createSection(jobs.slice(0, MAX_JOBS), jobs.length > MAX_JOBS);
    } catch (error) {
      return unavailableFor(error, signal);
    }
  }

  private async discoverSqlWarehouses(
    caller: CallerIdentity,
    signal: AbortSignal,
  ): Promise<InventorySection<WorkspaceSqlWarehouseResource>> {
    try {
      const warehouses = (await this.executionResources.listSqlWarehouses(caller, signal)).items;
      return createSection(warehouses.slice(0, MAX_SQL_WAREHOUSES), warehouses.length > MAX_SQL_WAREHOUSES);
    } catch (error) {
      return unavailableFor(error, signal);
    }
  }

  private async discoverLakebase(
    caller: CallerIdentity,
    signal: AbortSignal,
  ): Promise<InventorySection<AiBuilderLakebaseProject>> {
    let projects: WorkspaceLakebaseProjectResource[];
    try {
      projects = (await this.lakebaseResources.listProjects(caller, signal)).items;
    } catch (error) {
      return unavailableFor(error, signal);
    }
    if (projects.length === 0) return { status: "empty", items: [] };

    const projectResults = await mapWithConcurrency(
      projects.slice(0, MAX_LAKEBASE_PROJECTS),
      MAX_LAKEBASE_DISCOVERY_CONCURRENCY,
      async (project) => {
        const branches = await this.readBranches(caller, project, signal);
        const boundedBranches = branches.items.slice(0, MAX_LAKEBASE_BRANCHES_PER_PROJECT);
        const endpointResults = await mapWithConcurrency(
          boundedBranches,
          MAX_LAKEBASE_DISCOVERY_CONCURRENCY,
          (branch) => this.readEndpoints(caller, project, branch, signal),
          signal,
        );
        return {
          item: {
            projectId: project.projectId,
            displayName: project.displayName,
            branches: boundedBranches.map((branch, index) => ({
              branchId: branch.branchId,
              endpoints: endpointResults[index]?.items.slice(0, MAX_LAKEBASE_ENDPOINTS_PER_BRANCH) ?? [],
            })),
          },
          truncated: branches.items.length > MAX_LAKEBASE_BRANCHES_PER_PROJECT ||
            endpointResults.some((result) => result.items.length > MAX_LAKEBASE_ENDPOINTS_PER_BRANCH),
          failureReason: endpointResults.reduce(
            (reason, result) => mergeFailureReason(reason, result.failureReason),
            branches.failureReason,
          ),
        };
      },
      signal,
    );
    const items = projectResults.map((result) => result.item);
    const truncated = projects.length > MAX_LAKEBASE_PROJECTS || projectResults.some((result) => result.truncated);
    const failureReason = projectResults.reduce(
      (reason, result) => mergeFailureReason(reason, result.failureReason),
      undefined as DiscoveryFailureReason | undefined,
    );
    return createSection(items, truncated, failureReason);
  }

  private async readBranches(
    caller: CallerIdentity,
    project: WorkspaceLakebaseProjectResource,
    signal: AbortSignal,
  ): Promise<{ items: WorkspaceLakebaseBranchResource[]; failureReason?: DiscoveryFailureReason }> {
    try {
      return { items: (await this.lakebaseResources.listBranches(caller, project.projectId, signal)).items };
    } catch (error) {
      return { items: [], failureReason: readFailureReason(error, signal) };
    }
  }

  private async readEndpoints(
    caller: CallerIdentity,
    project: WorkspaceLakebaseProjectResource,
    branch: WorkspaceLakebaseBranchResource,
    signal: AbortSignal,
  ): Promise<{ items: WorkspaceLakebaseEndpointResource[]; failureReason?: DiscoveryFailureReason }> {
    try {
      return {
        items: (await this.lakebaseResources.listEndpoints(
          caller,
          project.projectId,
          branch.branchId,
          signal,
        )).items,
      };
    } catch (error) {
      return { items: [], failureReason: readFailureReason(error, signal) };
    }
  }
}

function createSection<T>(
  items: T[],
  truncated: boolean,
  reason?: DiscoveryFailureReason,
): InventorySection<T> {
  if (items.length === 0 && reason) return { status: "unavailable", items, reason };
  if (truncated || reason) return {
    status: "partial",
    items,
    ...(truncated ? { truncated: true } : {}),
    ...(reason ? { reason } : {}),
  };
  return { status: items.length === 0 ? "empty" : "available", items };
}

function unavailableFor(error: unknown, signal: AbortSignal): InventorySection<never> {
  const reason = readFailureReason(error, signal);
  return { status: "unavailable", items: [], reason };
}

function readFailureReason(error: unknown, signal: AbortSignal): DiscoveryFailureReason {
  if (signal.aborted) throw error;
  if (!(error instanceof ApplicationError)) throw error;
  return error.status === 401 || error.status === 403
    ? "permission_required"
    : "temporarily_unavailable";
}

function mergeFailureReason(
  current: DiscoveryFailureReason | undefined,
  next: DiscoveryFailureReason | undefined,
): DiscoveryFailureReason | undefined {
  if (!current) return next;
  if (!next) return current;
  return current === "permission_required" || next === "permission_required"
    ? "permission_required"
    : "temporarily_unavailable";
}

function fitContextByteLimit(context: AiBuilderResourceContext): AiBuilderResourceContext {
  while (Buffer.byteLength(JSON.stringify(context), "utf8") > MAX_CONTEXT_BYTES) {
    if (context.unityCatalogTables.items.length > 0) {
      trimSection(context.unityCatalogTables);
    } else if (context.jobs.items.length > 0) {
      trimSection(context.jobs);
    } else if (context.sqlWarehouses.items.length > 0) {
      trimSection(context.sqlWarehouses);
    } else if (!trimLakebase(context.lakebaseAutoscaling)) {
      throw new Error("The AI Builder resource context cannot fit its safe byte limit.");
    }
  }
  return context;
}

function trimSection<T>(section: InventorySection<T>): void {
  section.items.pop();
  markTruncated(section);
}

function trimLakebase(section: InventorySection<AiBuilderLakebaseProject>): boolean {
  for (let projectIndex = section.items.length - 1; projectIndex >= 0; projectIndex -= 1) {
    const project = section.items[projectIndex];
    if (!project) continue;
    for (let branchIndex = project.branches.length - 1; branchIndex >= 0; branchIndex -= 1) {
      const branch = project.branches[branchIndex];
      if (branch?.endpoints.length) {
        branch.endpoints.pop();
        markTruncated(section);
        return true;
      }
    }
    if (project.branches.length) {
      project.branches.pop();
      markTruncated(section);
      return true;
    }
    section.items.pop();
    markTruncated(section);
    return true;
  }
  return false;
}

function markTruncated<T>(section: InventorySection<T>): void {
  section.status = "partial";
  section.truncated = true;
}

async function mapWithConcurrency<T, TResult>(
  values: T[],
  maxConcurrency: number,
  mapValue: (value: T) => Promise<TResult>,
  signal: AbortSignal,
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    while (nextIndex < values.length) {
      signal.throwIfAborted();
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await mapValue(value);
    }
  };
  const workerCount = Math.min(maxConcurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}
