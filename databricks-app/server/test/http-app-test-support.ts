import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createHttpApp } from "../src/http-app.ts";
import { createIdentityResolver } from "../src/identity.ts";
import type { CallerIdentity, WorkspaceAppsPage } from "../src/contracts.ts";
import type { WorkspaceAppsClient } from "../src/workspace-apps-client.ts";
import { WorkspaceAppsService } from "../src/workspace-apps-service.ts";
import type { WorkspaceResourcesClient } from "../src/workspace-resources-client.ts";
import { WorkspaceResourcesService } from "../src/workspace-resources-service.ts";
import { WorkspaceExecutionResourcesService } from "../src/workspace-execution-resources-service.ts";
import { LocalTestWorkspaceExecutionResourcesClient } from "../src/local-test-workspace-execution-resources-client.ts";
import { WorkspaceLakebaseResourcesService } from "../src/workspace-lakebase-resources-service.ts";
import { LocalTestWorkspaceLakebaseResourcesClient } from "../src/local-test-workspace-lakebase-resources-client.ts";
import type { WorkspaceLakebaseResourcesClient } from "../src/workspace-lakebase-resources-client.ts";
import type { WorkspaceLakebaseProvisionedResourcesClient } from "../src/workspace-lakebase-provisioned-resources-client.ts";
import { LocalTestWorkspaceLakebaseProvisionedResourcesClient } from "../src/local-test-workspace-lakebase-provisioned-resources-client.ts";
import { WorkspaceLakebaseProvisionedResourcesService } from "../src/workspace-lakebase-provisioned-resources-service.ts";
import { LocalTestProjectRepository } from "../src/db/local-test-project-repository.ts";
import type { ProjectRepository } from "../src/db/project-repository.ts";
import { ProjectService } from "../src/db/project-service.ts";
import { ProjectComponentsService } from "../src/db/project-components-service.ts";
import { ProjectWorkflowService } from "../src/db/project-workflow-service.ts";
import type { ProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectWorkflowRepository } from "../src/db/project-workflow-repository.ts";
import type { ProjectCustomModulesRepository } from "../src/db/project-custom-modules-repository.ts";
import { ProjectCustomModulesService } from "../src/db/project-custom-modules-service.ts";
import type { ProjectPortabilityRepository } from "../src/db/project-portability-repository.ts";
import { ProjectPortabilityService } from "../src/db/project-portability-service.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { ProjectPreviewService } from "../src/generation/project-preview-service.ts";
import type { AiBuilderService } from "../src/ai-builder-service.ts";
import type { ProjectDeploymentService } from "../src/project-deployment-service.ts";
import type { WorkspaceSetupDiagnosticsProvider } from "../src/workspace-setup-diagnostics-service.ts";

export const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
export const FORWARDED_TOKEN = "caller-token-never-return-this";

export interface AppHarnessOptions {
  identityResolver?: ReturnType<typeof createIdentityResolver>;
  projectRepository?: ProjectRepository &
    ProjectComponentsRepository &
    ProjectWorkflowRepository &
    ProjectCustomModulesRepository &
    ProjectPortabilityRepository;
  workspaceAppsClient?: WorkspaceAppsClient;
  workspaceResourcesClient?: WorkspaceResourcesClient;
  workspaceExecutionResourcesClient?: import("../src/workspace-execution-resources-client.ts").WorkspaceExecutionResourcesClient;
  workspaceLakebaseResourcesClient?: WorkspaceLakebaseResourcesClient;
  workspaceLakebaseProvisionedResourcesClient?: WorkspaceLakebaseProvisionedResourcesClient;
  maxRequestBytes?: number;
  aiBuilderService?: AiBuilderService;
  projectDeploymentService?: ProjectDeploymentService;
  workspaceSetupDiagnosticsService?: WorkspaceSetupDiagnosticsProvider;
}

export interface AppHarness {
  baseUrl: string;
  server: Server;
  dispose: () => Promise<void>;
}

export async function createAppHarness(
  options: AppHarnessOptions = {},
): Promise<AppHarness> {
  const staticDirectory = await mkdtemp(join(tmpdir(), "vdab-app-test-"));
  await writeFile(
    join(staticDirectory, "index.html"),
    "<!doctype html><title>test</title>",
  );
  const identityResolver =
    options.identityResolver ??
    createIdentityResolver({
      authenticationMode: "local-test",
      nodeEnvironment: "test",
      localUserId: "local-editor",
      workspaceHost: undefined,
      workspaceId: undefined,
    });
  const workspaceAppsService = new WorkspaceAppsService(
    options.workspaceAppsClient ?? createEmptyAppsClient(),
  );
  const workspaceResourcesService = new WorkspaceResourcesService(
    options.workspaceResourcesClient ?? createEmptyWorkspaceResourcesClient(),
  );
  const workspaceExecutionResourcesService =
    new WorkspaceExecutionResourcesService(
      options.workspaceExecutionResourcesClient ??
        new LocalTestWorkspaceExecutionResourcesClient(),
    );
  const workspaceLakebaseResourcesService =
    new WorkspaceLakebaseResourcesService(
      options.workspaceLakebaseResourcesClient ??
        new LocalTestWorkspaceLakebaseResourcesClient(),
    );
  const workspaceLakebaseProvisionedResourcesService =
    new WorkspaceLakebaseProvisionedResourcesService(
      options.workspaceLakebaseProvisionedResourcesClient ??
        new LocalTestWorkspaceLakebaseProvisionedResourcesClient(),
    );
  const projectRepository =
    options.projectRepository ?? new LocalTestProjectRepository();
  const projectService = new ProjectService(
    projectRepository,
    "test-workspace",
  );
  const projectComponentsService = new ProjectComponentsService(
    projectRepository,
    "test-workspace",
  );
  const componentRegistryService = new ComponentRegistryService();
  const projectWorkflowService = new ProjectWorkflowService(
    projectRepository,
    "test-workspace",
    projectComponentsService,
    componentRegistryService,
  );
  const projectCustomModulesService = new ProjectCustomModulesService(
    projectRepository,
    projectRepository,
    "test-workspace",
  );
  const projectPreviewService = new ProjectPreviewService(
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
  );
  const projectPortabilityService = new ProjectPortabilityService(
    projectRepository,
    "test-workspace",
  );
  const server = createHttpApp({
    identityResolver,
    workspaceAppsService,
    workspaceResourcesService,
    workspaceExecutionResourcesService,
    workspaceLakebaseResourcesService,
    workspaceLakebaseProvisionedResourcesService,
    workspaceSetupDiagnosticsService:
      options.workspaceSetupDiagnosticsService ??
      ({
        getDiagnostics: async () => ({
          lakebase: {
            status: "local-test",
            configuredFields: [],
            missingFields: [],
            message: "Local test mode does not verify a Lakebase binding.",
          },
          defaultSqlWarehouse: {
            status: "local-test",
            message: "Local test mode does not verify a SQL warehouse.",
          },
          authorization: {
            status: "local-test",
            requestedScopes: [],
            effectiveScopes: [],
            consentedScopes: [],
            missingScopes: [],
            message: "Local test mode does not verify Databricks consent.",
          },
        }),
      } satisfies WorkspaceSetupDiagnosticsProvider),
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
    projectPreviewService,
    projectDeploymentService: options.projectDeploymentService,
    projectPortabilityService,
    aiBuilderService: options.aiBuilderService,
    componentRegistryService,
    staticDirectory,
    workspaceId: "test-workspace",
    workspaceHost: WORKSPACE_HOST,
    maxRequestBytes: options.maxRequestBytes,
    logRequest: () => undefined,
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    dispose: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }

          resolveClose();
        });
      });
      await rm(staticDirectory, { recursive: true, force: true });
    },
  };
}

export function createEmptyAppsClient(): WorkspaceAppsClient {
  return {
    listApps: async (): Promise<WorkspaceAppsPage> => ({
      items: [],
      nextPageToken: null,
      authenticationMode: "local-test",
    }),
  };
}

export function createEmptyWorkspaceResourcesClient(): WorkspaceResourcesClient {
  return {
    listCatalogs: async () => [],
    listTableSummaries: async () => ({ items: [], hasMore: false }),
    listSchemas: async () => [],
    listVolumes: async () => [],
    listTables: async () => [],
    listGenieSpaces: async () => [],
    listServingEndpoints: async () => [],
  };
}

export function readProjectId(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("The HTTP test response did not contain a project ID.");
  }

  return value.id;
}

export function readProjectVersion(value: unknown): number {
  if (!isRecord(value) || typeof value.version !== "number") {
    throw new Error(
      "The HTTP test response did not contain a project version.",
    );
  }

  return value.version;
}

export function readWorkflowDefinition(value: unknown): unknown {
  if (!isRecord(value) || !("workflow" in value)) {
    throw new Error("The HTTP test response did not contain the workflow.");
  }

  return value.workflow;
}

export function readCustomModulesSource(value: unknown): string {
  if (!isRecord(value) || typeof value.source !== "string") {
    throw new Error(
      "The HTTP test response did not contain custom module source.",
    );
  }
  return value.source;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
