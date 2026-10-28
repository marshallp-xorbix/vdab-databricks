import type { Pool } from "pg";
import { resolve } from "node:path";
import { LocalTestProjectRepository } from "./db/local-test-project-repository.ts";
import { createLakebasePool } from "./db/lakebase-pool.ts";
import { runLakebaseMigrations } from "./db/migrations.ts";
import { PostgresProjectRepository } from "./db/project-repository.ts";
import { ProjectService } from "./db/project-service.ts";
import { ProjectComponentsService } from "./db/project-components-service.ts";
import { PostgresProjectComponentsRepository } from "./db/project-components-repository.ts";
import { PostgresProjectWorkflowRepository } from "./db/project-workflow-repository.ts";
import { ProjectWorkflowService } from "./db/project-workflow-service.ts";
import { PostgresProjectCustomModulesRepository } from "./db/project-custom-modules-repository.ts";
import { ProjectCustomModulesService } from "./db/project-custom-modules-service.ts";
import { PostgresProjectPortabilityRepository } from "./db/project-portability-repository.ts";
import { ProjectPortabilityService } from "./db/project-portability-service.ts";
import { PostgresProjectDeploymentRepository } from "./db/project-deployment-repository.ts";
import { ProjectDeploymentService } from "./project-deployment-service.ts";
import { createWorkspaceAppDeploymentClient } from "./workspace-app-deployment-client.ts";
import { createHttpApp } from "./http-app.ts";
import { createIdentityResolver } from "./identity.ts";
import { LocalTestWorkspaceAppsClient } from "./local-test-workspace-apps-client.ts";
import { createWorkspaceAppsClient } from "./workspace-apps-client.ts";
import { WorkspaceAppsService } from "./workspace-apps-service.ts";
import { ComponentRegistryService } from "./component-registry/component-registry-service.ts";
import { ProjectPreviewService } from "./generation/project-preview-service.ts";
import { LocalTestWorkspaceResourcesClient } from "./local-test-workspace-resources-client.ts";
import { createWorkspaceResourcesClient } from "./workspace-resources-client.ts";
import { WorkspaceResourcesService } from "./workspace-resources-service.ts";
import { createWorkspaceExecutionResourcesClient } from "./workspace-execution-resources-client.ts";
import { LocalTestWorkspaceExecutionResourcesClient } from "./local-test-workspace-execution-resources-client.ts";
import { WorkspaceExecutionResourcesService } from "./workspace-execution-resources-service.ts";
import { createWorkspaceLakebaseResourcesClient } from "./workspace-lakebase-resources-client.ts";
import { LocalTestWorkspaceLakebaseResourcesClient } from "./local-test-workspace-lakebase-resources-client.ts";
import { WorkspaceLakebaseResourcesService } from "./workspace-lakebase-resources-service.ts";
import { createWorkspaceLakebaseProvisionedResourcesClient } from "./workspace-lakebase-provisioned-resources-client.ts";
import { LocalTestWorkspaceLakebaseProvisionedResourcesClient } from "./local-test-workspace-lakebase-provisioned-resources-client.ts";
import { WorkspaceLakebaseProvisionedResourcesService } from "./workspace-lakebase-provisioned-resources-service.ts";
import { AiBuilderService } from "./ai-builder-service.ts";
import { AiBuilderResourceContextService } from "./ai-builder-resource-context.ts";
import { AiBuilderWorkspaceClient } from "./ai-builder-workspace-client.ts";
import { createWorkspaceSetupDiagnosticsClient } from "./workspace-setup-diagnostics-client.ts";
import { WorkspaceSetupDiagnosticsService } from "./workspace-setup-diagnostics-service.ts";
import { normalizeWorkspaceHost } from "./workspace-host.ts";

const DEFAULT_PORT = 8000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const AUTHENTICATION_MODE_LOCAL_TEST = "local-test";
const AUTHENTICATION_MODE_DATABRICKS = "databricks";
const authenticationMode = process.env.VDAB_AUTH_MODE;
const isLocalTestMode = authenticationMode === AUTHENTICATION_MODE_LOCAL_TEST;
const workspaceHost = isLocalTestMode
  ? null
  : process.env.DATABRICKS_HOST
    ? normalizeWorkspaceHost(process.env.DATABRICKS_HOST)
    : null;
const workspaceId = isLocalTestMode
  ? "local-test-workspace"
  : (process.env.DATABRICKS_WORKSPACE_ID ?? null);
const staticDirectory = resolve(import.meta.dirname, "../../public");

await start();

async function start(): Promise<void> {
  const identityResolver = createIdentityResolver();
  const workspaceAppsClient = isLocalTestMode
    ? new LocalTestWorkspaceAppsClient()
    : createWorkspaceAppsClient(requireWorkspaceHost(workspaceHost));
  const workspaceAppsService = new WorkspaceAppsService(workspaceAppsClient);
  const workspaceSetupDiagnosticsService = new WorkspaceSetupDiagnosticsService(
    createWorkspaceSetupDiagnosticsClient(
      workspaceHost,
      isLocalTestMode ? null : (process.env.DATABRICKS_APP_NAME ?? null),
    ),
    process.env,
  );
  const workspaceResourcesClient = isLocalTestMode
    ? new LocalTestWorkspaceResourcesClient()
    : createWorkspaceResourcesClient(requireWorkspaceHost(workspaceHost));
  const workspaceResourcesService = new WorkspaceResourcesService(
    workspaceResourcesClient,
  );
  const workspaceExecutionResourcesClient = isLocalTestMode
    ? new LocalTestWorkspaceExecutionResourcesClient()
    : createWorkspaceExecutionResourcesClient(
        requireWorkspaceHost(workspaceHost),
      );
  const workspaceExecutionResourcesService =
    new WorkspaceExecutionResourcesService(workspaceExecutionResourcesClient);
  const workspaceLakebaseResourcesClient = isLocalTestMode
    ? new LocalTestWorkspaceLakebaseResourcesClient()
    : createWorkspaceLakebaseResourcesClient(
        requireWorkspaceHost(workspaceHost),
      );
  const workspaceLakebaseResourcesService =
    new WorkspaceLakebaseResourcesService(workspaceLakebaseResourcesClient);
  const workspaceLakebaseProvisionedResourcesClient = isLocalTestMode
    ? new LocalTestWorkspaceLakebaseProvisionedResourcesClient()
    : createWorkspaceLakebaseProvisionedResourcesClient(
        requireWorkspaceHost(workspaceHost),
      );
  const workspaceLakebaseProvisionedResourcesService =
    new WorkspaceLakebaseProvisionedResourcesService(
      workspaceLakebaseProvisionedResourcesClient,
    );
  const lakebasePool = await createProjectPool();
  const localProjectRepository = new LocalTestProjectRepository();
  const projectRepository = lakebasePool
    ? new PostgresProjectRepository(lakebasePool)
    : localProjectRepository;
  const projectComponentsRepository = lakebasePool
    ? new PostgresProjectComponentsRepository(lakebasePool)
    : localProjectRepository;
  const projectWorkflowRepository = lakebasePool
    ? new PostgresProjectWorkflowRepository(lakebasePool)
    : localProjectRepository;
  const projectCustomModulesRepository = lakebasePool
    ? new PostgresProjectCustomModulesRepository(lakebasePool)
    : localProjectRepository;
  const projectPortabilityRepository = lakebasePool
    ? new PostgresProjectPortabilityRepository(lakebasePool)
    : localProjectRepository;
  const projectService = new ProjectService(
    projectRepository,
    requireWorkspaceId(workspaceId),
  );
  const projectComponentsService = new ProjectComponentsService(
    projectComponentsRepository,
    requireWorkspaceId(workspaceId),
  );
  const componentRegistryService = new ComponentRegistryService();
  const projectWorkflowService = new ProjectWorkflowService(
    projectWorkflowRepository,
    requireWorkspaceId(workspaceId),
    projectComponentsService,
    componentRegistryService,
  );
  const projectCustomModulesService = new ProjectCustomModulesService(
    projectCustomModulesRepository,
    projectRepository,
    requireWorkspaceId(workspaceId),
  );
  const projectPreviewService = new ProjectPreviewService(
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
    undefined,
    process.env.DATABRICKS_SQL_WAREHOUSE_ID ?? null,
  );
  const projectPortabilityService = new ProjectPortabilityService(
    projectPortabilityRepository,
    requireWorkspaceId(workspaceId),
  );
  const projectDeploymentRepository = lakebasePool
    ? new PostgresProjectDeploymentRepository(lakebasePool)
    : null;
  const projectDeploymentService =
    projectDeploymentRepository && workspaceHost
      ? new ProjectDeploymentService(
          projectService,
          projectPreviewService,
          projectDeploymentRepository,
          createWorkspaceAppDeploymentClient(
            workspaceHost,
            requireInstalledAppName(process.env.DATABRICKS_APP_NAME ?? null),
          ),
          requireWorkspaceId(workspaceId),
        )
      : undefined;
  const aiBuilderService = workspaceHost
    ? new AiBuilderService(
        projectService,
        projectComponentsService,
        projectWorkflowService,
        projectCustomModulesService,
        workspaceResourcesService,
        componentRegistryService,
        new AiBuilderWorkspaceClient(workspaceHost),
        new AiBuilderResourceContextService(
          workspaceResourcesService,
          workspaceExecutionResourcesService,
          workspaceLakebaseResourcesService,
        ),
      )
    : undefined;
  const httpApp = createHttpApp({
    identityResolver,
    workspaceAppsService,
    workspaceResourcesService,
    workspaceExecutionResourcesService,
    workspaceLakebaseResourcesService,
    workspaceLakebaseProvisionedResourcesService,
    workspaceSetupDiagnosticsService,
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
    projectPreviewService,
    projectDeploymentService,
    projectPortabilityService,
    aiBuilderService,
    componentRegistryService,
    staticDirectory,
    workspaceHost,
    workspaceId,
    logRequest: (record) => {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    },
  });
  const port = resolvePort(process.env.DATABRICKS_APP_PORT ?? process.env.PORT);

  httpApp.listen(port, "0.0.0.0", () => {
    process.stdout.write(
      `${JSON.stringify({ event: "server.started", port, host: "0.0.0.0" })}\n`,
    );
  });

  process.once("SIGINT", () => shutdown(httpApp, lakebasePool, "SIGINT"));
  process.once("SIGTERM", () => shutdown(httpApp, lakebasePool, "SIGTERM"));
}

async function createProjectPool(): Promise<Pool | null> {
  if (isLocalTestMode) {
    return null;
  }

  if (authenticationMode !== AUTHENTICATION_MODE_DATABRICKS) {
    throw new Error(
      "Databricks authentication is required for Lakebase access.",
    );
  }

  const lakebasePool = createLakebasePool();

  try {
    await runLakebaseMigrations(lakebasePool);
    return lakebasePool;
  } catch (error) {
    await lakebasePool.end();
    throw error;
  }
}

function resolvePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DATABRICKS_APP_PORT must be a valid TCP port.");
  }

  return port;
}

function requireWorkspaceHost(host: string | null): string {
  if (!host) {
    throw new Error(
      "DATABRICKS_HOST is required in Databricks authentication mode.",
    );
  }

  return host;
}

function requireWorkspaceId(id: string | null): string {
  if (!id) {
    throw new Error(
      "DATABRICKS_WORKSPACE_ID is required to isolate builder data.",
    );
  }

  return id;
}

function requireInstalledAppName(appName: string | null): string {
  if (!appName || !/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(appName)) {
    throw new Error(
      "DATABRICKS_APP_NAME must contain a valid installed Databricks App name.",
    );
  }
  return appName;
}

function shutdown(
  server: ReturnType<typeof createHttpApp>,
  lakebasePool: Pool | null,
  signal: string,
): void {
  process.stdout.write(
    `${JSON.stringify({ event: "server.stopping", signal })}\n`,
  );

  const shutdownTimer = setTimeout(() => {
    server.closeAllConnections();
  }, SHUTDOWN_TIMEOUT_MS);
  shutdownTimer.unref();

  server.close(() => {
    void closeResources(lakebasePool, shutdownTimer, signal);
  });
}

async function closeResources(
  lakebasePool: Pool | null,
  shutdownTimer: NodeJS.Timeout,
  signal: string,
): Promise<void> {
  clearTimeout(shutdownTimer);

  if (lakebasePool) {
    await lakebasePool.end();
  }

  process.stdout.write(
    `${JSON.stringify({ event: "server.stopped", signal })}\n`,
  );
}
