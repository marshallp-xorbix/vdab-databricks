import { randomUUID } from "node:crypto";
import type {
  CallerIdentity,
  ProjectDeploymentSourceFile,
  ProjectDeploymentStatus,
  ProjectDeploymentSummary,
  WorkspaceAppDeploymentStatus,
} from "../src/contracts.ts";
import { ApplicationError } from "../src/application-error.ts";
import type {
  NewProjectDeployment,
  ProjectChildAppRecord,
  ProjectDeploymentRecord,
  ProjectDeploymentRepository,
  ProjectDeploymentUpdate,
} from "../src/db/project-deployment-repository.ts";
import type { ProjectService } from "../src/db/project-service.ts";
import type { ProjectPreviewService } from "../src/generation/project-preview-service.ts";
import { ProjectDeploymentService } from "../src/project-deployment-service.ts";
import type {
  WorkspaceAppDeploymentClient,
  WorkspaceAppDetails,
} from "../src/workspace-app-deployment-client.ts";

export interface HarnessOptions {
  callerRole?: string;
  appSpaceName?: string | null;
  requirements?: {
    userApiScopes: string[];
    appResources: WorkspaceAppDetails["resources"];
    blockers: Array<{ code: string; detail: string }>;
  };
}

export function createHarness(options: HarnessOptions = {}) {
  const repository = new MemoryDeploymentRepository();
  const workspace = new MemoryWorkspaceAppsClient(options.appSpaceName ?? null);
  const projectService = {
    getProject: async () => ({ callerRole: options.callerRole ?? "owner" }),
  } as unknown as ProjectService;
  const previewService = {
    generateDeploymentSource: async () => ({
      preview: {
        version: 3,
        files: [
          {
            path: "app.py",
            content: "import streamlit as st\nst.title('Demo')\n",
          },
        ],
      },
      requirements: options.requirements ?? {
        userApiScopes: ["sql"],
        appResources: [],
        blockers: [],
      },
    }),
  } as unknown as ProjectPreviewService;
  return {
    repository,
    workspace,
    service: new ProjectDeploymentService(
      projectService,
      previewService,
      repository,
      workspace,
      "test-workspace",
    ),
  };
}

class MemoryDeploymentRepository implements ProjectDeploymentRepository {
  private childApp: ProjectChildAppRecord | null = null;
  readonly records: ProjectDeploymentRecord[] = [];
  readonly auditActions: string[] = [];

  async getChildApp(): Promise<ProjectChildAppRecord | null> {
    return this.childApp ? structuredClone(this.childApp) : null;
  }

  async createDeployment(
    projectId: string,
    _actor: Parameters<ProjectDeploymentRepository["createDeployment"]>[1],
    input: NewProjectDeployment,
  ): Promise<ProjectDeploymentRecord> {
    if (!this.childApp) {
      this.childApp = {
        appId: input.appId,
        appName: input.appName,
        mode: input.mode,
        sourceCodePath: null,
        createMarker: input.createMarker,
      };
    }
    const record = makeRecord(projectId, input, this.childApp);
    this.records.push(record);
    return structuredClone(record);
  }

  async createRecoveryDeployment(
    projectId: string,
    _actor: Parameters<
      ProjectDeploymentRepository["createRecoveryDeployment"]
    >[1],
    sourceDeploymentId: string,
    mode: "retry" | "rollback",
  ): Promise<ProjectDeploymentRecord> {
    const source = this.records.find(
      (record) => record.id === sourceDeploymentId,
    );
    if (!source)
      throw new ApplicationError(
        404,
        "deployment_not_found",
        "Deployment not found",
        "Missing deployment.",
      );
    if (
      mode === "retry" &&
      source.status !== "failed" &&
      source.status !== "cancelled"
    ) {
      throw new ApplicationError(
        409,
        "deployment_not_retryable",
        "Cannot retry",
        "Deployment is not failed.",
      );
    }
    if (mode === "rollback" && source.status !== "succeeded") {
      throw new ApplicationError(
        409,
        "deployment_not_rollback_target",
        "Cannot roll back",
        "Deployment is not successful.",
      );
    }
    const record: ProjectDeploymentRecord = {
      ...structuredClone(source),
      id: randomUUID(),
      projectId,
      status: "pending",
      deploymentId: null,
      sourceCodePath: null,
      failureCode: null,
      attemptOf: source.id,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    this.records.push(record);
    return structuredClone(record);
  }

  async listDeployments(): Promise<ProjectDeploymentSummary[]> {
    return this.records.map(toSummary);
  }

  async getDeployment(
    _projectId: string,
    deploymentId: string,
  ): Promise<ProjectDeploymentRecord | null> {
    const record = this.records.find((item) => item.id === deploymentId);
    return record ? structuredClone(record) : null;
  }

  async updateDeployment(
    _projectId: string,
    deploymentId: string,
    _actor: Parameters<ProjectDeploymentRepository["updateDeployment"]>[2],
    update: ProjectDeploymentUpdate,
  ): Promise<ProjectDeploymentRecord | null> {
    this.auditActions.push(update.action);
    const record = this.records.find((item) => item.id === deploymentId);
    if (!record) return null;
    if (update.status) {
      record.status = update.status;
      record.completedAt = ["succeeded", "failed", "cancelled"].includes(
        update.status,
      )
        ? new Date().toISOString()
        : null;
    }
    if (update.deploymentId !== undefined)
      record.deploymentId = update.deploymentId;
    if (update.sourceCodePath !== undefined) {
      record.sourceCodePath = update.sourceCodePath;
      if (this.childApp) this.childApp.sourceCodePath = update.sourceCodePath;
    }
    if (update.appId !== undefined) {
      record.appId = update.appId;
      if (this.childApp) this.childApp.appId = update.appId;
    }
    if (update.failureCode !== undefined)
      record.failureCode = update.failureCode;
    return structuredClone(record);
  }
}

class MemoryWorkspaceAppsClient implements WorkspaceAppDeploymentClient {
  private readonly appSpaceName: string | null;
  readonly apps = new Map<string, WorkspaceAppDetails>();
  readonly createdApps: Array<{
    name: string;
    userApiScopes: string[];
    spaceName: string | null;
  }> = [];
  createdAppResources: WorkspaceAppDetails["resources"] = [];
  readonly uploads: Array<{
    sourceCodePath: string;
    files: ProjectDeploymentSourceFile[];
  }> = [];
  readonly submittedPaths: string[] = [];
  nextDeploymentState: ProjectDeploymentStatus = "succeeded";
  private deploymentIndex = 0;

  constructor(appSpaceName: string | null) {
    this.appSpaceName = appSpaceName;
  }

  async getInstalledAppSpace(): Promise<string | null> {
    return this.appSpaceName;
  }

  async countApps(): Promise<number> {
    return this.apps.size;
  }

  async getApp(
    _caller: CallerIdentity,
    appName: string,
  ): Promise<WorkspaceAppDetails | null> {
    return this.apps.has(appName)
      ? structuredClone(this.apps.get(appName) ?? null)
      : null;
  }

  async updateAppResources(
    _caller: CallerIdentity,
    appName: string,
    resources: WorkspaceAppDetails["resources"],
  ): Promise<void> {
    const app = this.apps.get(appName);
    if (app) app.resources = structuredClone(resources);
  }

  async createApp(
    _caller: CallerIdentity,
    appName: string,
    description: string,
    userApiScopes: string[],
    appResources: WorkspaceAppDetails["resources"],
    appSpaceName: string | null,
  ): Promise<WorkspaceAppDetails> {
    const app = makeApp({
      appId: `app-${this.apps.size + 1}`,
      name: appName,
      description,
      spaceName: appSpaceName,
      userApiScopes,
      resources: structuredClone(appResources),
    });
    this.apps.set(appName, app);
    this.createdApps.push({
      name: appName,
      userApiScopes: [...userApiScopes],
      spaceName: appSpaceName,
    });
    this.createdAppResources = structuredClone(appResources);
    return structuredClone(app);
  }

  async uploadSource(
    _caller: CallerIdentity,
    sourceCodePath: string,
    files: ProjectDeploymentSourceFile[],
  ): Promise<void> {
    this.uploads.push({ sourceCodePath, files: structuredClone(files) });
  }

  async createDeployment(
    _caller: CallerIdentity,
    _appName: string,
    sourceCodePath: string,
  ): Promise<WorkspaceAppDeploymentStatus> {
    this.submittedPaths.push(sourceCodePath);
    this.deploymentIndex += 1;
    const status = {
      deploymentId: `deployment-${this.deploymentIndex}`,
      state: this.nextDeploymentState,
    };
    this.nextDeploymentState = "succeeded";
    return status;
  }

  async getDeployment(
    _caller: CallerIdentity,
    _appName: string,
    deploymentId: string,
  ): Promise<WorkspaceAppDeploymentStatus> {
    const state: ProjectDeploymentStatus = deploymentId.endsWith("1")
      ? "failed"
      : "succeeded";
    return { deploymentId, state };
  }
}

export function makeApp(
  overrides: Partial<WorkspaceAppDetails> = {},
): WorkspaceAppDetails {
  const effectiveUserApiScopes = Object.hasOwn(
    overrides,
    "effectiveUserApiScopes",
  )
    ? (overrides.effectiveUserApiScopes ?? null)
    : overrides.spaceName
      ? (overrides.userApiScopes ?? ["sql"])
      : null;
  const app: WorkspaceAppDetails = {
    appId: "app-existing",
    name: "existing-child",
    description: null,
    spaceName: null,
    effectiveUserApiScopes: null,
    appState: "STOPPED",
    computeState: "STOPPED",
    appUrl: null,
    activeDeploymentId: null,
    sourceCodePath: null,
    usesGitSource: false,
    userApiScopes: ["sql"],
    resources: [],
    unsupportedResourceCount: 0,
    ...overrides,
  };
  app.effectiveUserApiScopes = effectiveUserApiScopes;
  return app;
}

function makeRecord(
  projectId: string,
  input: NewProjectDeployment,
  childApp: ProjectChildAppRecord,
): ProjectDeploymentRecord {
  return {
    id: randomUUID(),
    projectId,
    appName: input.appName,
    mode: input.mode,
    sourceVersion: input.sourceVersion,
    status: "pending",
    deploymentId: null,
    sourceCodePath: null,
    failureCode: null,
    attemptOf: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    sourceFiles: structuredClone(input.sourceFiles),
    appId: childApp.appId,
    requiredUserApiScopes: [...input.requiredUserApiScopes],
    requiredAppResources: structuredClone(input.requiredAppResources),
  };
}

function toSummary(record: ProjectDeploymentRecord): ProjectDeploymentSummary {
  return {
    id: record.id,
    projectId: record.projectId,
    appName: record.appName,
    mode: record.mode,
    sourceVersion: record.sourceVersion,
    status: record.status,
    deploymentId: record.deploymentId,
    sourceCodePath: record.sourceCodePath,
    failureCode: record.failureCode,
    attemptOf: record.attemptOf,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}
