import { randomUUID } from "node:crypto";
import type {
  CallerIdentity,
  ProjectDeploymentHistory,
  ProjectDeploymentReadiness,
  ProjectDeploymentSourceFile,
  ProjectDeploymentSummary,
  WorkspaceAppResource,
  WorkspaceAppDeploymentTarget,
  WorkspaceSecretAppResource,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import {
  readStartProjectDeploymentInput,
  requireOverwriteConfirmation,
  validateProjectDeploymentId,
  validateWorkspaceAppName,
} from "./db/project-deployment-input.ts";
import type {
  ProjectDeploymentRecord,
  ProjectDeploymentRepository,
} from "./db/project-deployment-repository.ts";
import type { ProjectService } from "./db/project-service.ts";
import type { ProjectPreviewService } from "./generation/project-preview-service.ts";
import {
  createDeploymentSourcePath,
  validateGeneratedSource,
} from "./deployment-source-validation.ts";
import { addGeneratedAppManifest } from "./generated-app-manifest.ts";
import {
  toProjectDeploymentActor as toProjectActor,
  toProjectDeploymentSummary as toSummary,
  toPublicChildApp,
} from "./project-deployment-contract-mapping.ts";
import {
  canEditProjectDeployment as canEdit,
  childAppTargetConflict,
  deploymentNotFound,
  readProjectDeploymentFailureCode as readFailureCode,
  requireProjectDeploymentEditor as requireEditor,
} from "./project-deployment-service-errors.ts";
import type { WorkspaceAppDeploymentClient } from "./workspace-app-deployment-client.ts";
import type { WorkspaceAppDetails } from "./workspace-app-deployment-client.ts";
import { resolveWorkspaceSecretResources } from "./workspace-app-secret-resource-binding.ts";
import { validateWorkspaceAppResources } from "./workspace-app-resource-validation.ts";
import { ProjectDeploymentTargetService } from "./project-deployment-target-service.ts";

/** Coordinates caller-authorized generated App deployment and recovery. */
export class ProjectDeploymentService {
  private readonly projectService: ProjectService;
  private readonly previewService: ProjectPreviewService;
  private readonly repository: ProjectDeploymentRepository;
  private readonly workspaceClient: WorkspaceAppDeploymentClient;
  private readonly targetService: ProjectDeploymentTargetService;
  private readonly workspaceId: string;

  constructor(
    projectService: ProjectService,
    previewService: ProjectPreviewService,
    repository: ProjectDeploymentRepository,
    workspaceClient: WorkspaceAppDeploymentClient,
    workspaceId: string,
  ) {
    this.projectService = projectService;
    this.previewService = previewService;
    this.repository = repository;
    this.workspaceClient = workspaceClient;
    this.targetService = new ProjectDeploymentTargetService(workspaceClient);
    this.workspaceId = workspaceId;
  }

  /** Lists the linked child App and recent deployment history for an editor. */
  async listHistory(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectDeploymentHistory> {
    await this.projectService.getProject(caller, requestId, projectId);
    const actor = toProjectActor(caller, this.workspaceId, requestId);
    const [childApp, items] = await Promise.all([
      this.repository.getChildApp(projectId, actor),
      this.repository.listDeployments(projectId, actor),
    ]);
    return { childApp: childApp ? toPublicChildApp(childApp) : null, items };
  }

  /** Reads safe target details using the current user's workspace authorization. */
  async getWorkspaceAppDeploymentTarget(
    caller: CallerIdentity,
    rawAppName: string,
  ): Promise<WorkspaceAppDeploymentTarget | null> {
    const appName = validateWorkspaceAppName(rawAppName);
    const app = await this.workspaceClient.getApp(caller, appName);
    if (!app) return null;
    const { resources, ...target } = app;
    return {
      ...target,
      secretResources: resources.filter(isSecretResource),
    };
  }

  /** Reports local generator authorization requirements before a workspace mutation. */
  async getReadiness(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectDeploymentReadiness> {
    const project = await this.projectService.getProject(
      caller,
      requestId,
      projectId,
    );
    requireEditor(project.callerRole);
    const source = await this.previewService.generateDeploymentSource(
      caller,
      requestId,
      projectId,
    );
    return {
      userApiScopes: source.requirements.userApiScopes,
      appResources: source.requirements.appResources,
      blockers: source.requirements.blockers,
    };
  }

  /** Starts a new immutable source deployment or redeploys the linked child App. */
  async deploy(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<ProjectDeploymentSummary> {
    const project = await this.projectService.getProject(
      caller,
      requestId,
      projectId,
    );
    requireEditor(project.callerRole);
    const input = readStartProjectDeploymentInput(body);
    const actor = toProjectActor(caller, this.workspaceId, requestId);
    const childApp = await this.repository.getChildApp(projectId, actor);
    if (childApp)
      requireOverwriteConfirmation({
        confirmOverwrite: input.confirmOverwrite,
      });
    if (childApp && childApp.appName !== input.appName)
      throw childAppTargetConflict();
    const mode = childApp?.mode ?? input.mode;
    const source = await this.previewService.generateDeploymentSource(
      caller,
      requestId,
      projectId,
    );
    if (source.requirements.blockers.length > 0) {
      throw new ApplicationError(
        422,
        source.requirements.blockers[0]?.code ??
          "deployment_requirement_unavailable",
        "Project needs a supported Databricks authorization path",
        source.requirements.blockers.map((blocker) => blocker.detail).join(" "),
      );
    }
    const appSpaceName =
      await this.workspaceClient.getInstalledAppSpace(caller);
    const existingApp = await this.readCurrentTargetApp(
      caller,
      input.appName,
      mode,
      childApp,
    );
    const selectedSecretResources = resolveWorkspaceSecretResources(
      input.secretResources,
      existingApp?.resources ?? null,
    );
    const requiredAppResources = validateWorkspaceAppResources([
      ...source.requirements.appResources,
      ...selectedSecretResources,
    ]);

    if (!childApp) {
      await this.targetService.validateInitialTarget(
        caller,
        input.mode,
        input.appName,
        input.confirmOverwrite,
        source.requirements.userApiScopes,
        requiredAppResources,
        appSpaceName,
        existingApp,
      );
    } else if (existingApp) {
      this.targetService.validateExistingApp(
        existingApp,
        source.requirements.userApiScopes,
        requiredAppResources,
        childApp.appId,
        appSpaceName,
      );
    }

    const sourceFiles = addGeneratedAppManifest(
      source.preview.files,
      requiredAppResources,
    );
    const sourcePathProbe = createDeploymentSourcePath(
      caller,
      projectId,
      randomUUID(),
    );
    validateGeneratedSource(sourcePathProbe, sourceFiles);
    const createMarker =
      childApp?.createMarker ??
      (!childApp && mode === "createNew"
        ? `VDAB:${projectId}:${randomUUID()}`
        : null);
    const record = await this.repository.createDeployment(
      projectId,
      actor,
      {
        appName: input.appName,
        mode,
        appId: childApp?.appId ?? null,
        createMarker,
        sourceVersion: source.preview.version,
        sourceFiles,
        requiredUserApiScopes: source.requirements.userApiScopes,
        requiredAppResources,
      },
      requestId,
    );
    return this.deploySnapshot(
      caller,
      requestId,
      actor,
      projectId,
      record,
      createMarker,
      appSpaceName,
    );
  }

  private async readCurrentTargetApp(
    caller: CallerIdentity,
    appName: string,
    mode: "createNew" | "linkExisting",
    childApp: Awaited<ReturnType<ProjectDeploymentRepository["getChildApp"]>>,
  ): Promise<WorkspaceAppDetails | null> {
    if (!childApp && mode === "createNew") return null;
    if (childApp?.mode === "createNew" && !childApp.appId) {
      return this.workspaceClient.getApp(caller, appName);
    }
    return this.targetService.requireExistingApp(caller, appName);
  }

  /** Refreshes the selected Databricks deployment state without exposing source. */
  async getDeployment(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    rawDeploymentId: string,
  ): Promise<ProjectDeploymentSummary> {
    const deploymentId = validateProjectDeploymentId(rawDeploymentId);
    const project = await this.projectService.getProject(
      caller,
      requestId,
      projectId,
    );
    const actor = toProjectActor(caller, this.workspaceId, requestId);
    const record = await this.repository.getDeployment(
      projectId,
      deploymentId,
      actor,
    );
    if (!record) throw deploymentNotFound();
    if (
      canEdit(project.callerRole) &&
      (record.status === "pending" || record.status === "running") &&
      record.deploymentId
    ) {
      const remote = await this.workspaceClient.getDeployment(
        caller,
        record.appName,
        record.deploymentId,
      );
      if (remote.state !== record.status) {
        const updated = await this.repository.updateDeployment(
          projectId,
          record.id,
          actor,
          {
            action: "deployment.status.refreshed",
            status: remote.state,
            failureCode:
              remote.state === "failed" ? "workspace_deployment_failed" : null,
          },
        );
        if (updated) return toSummary(updated);
      }
    }
    return toSummary(record);
  }

  /** Retries a failed deployment from its saved Lakebase source snapshot. */
  async retry(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    rawDeploymentId: string,
    body: unknown,
  ): Promise<ProjectDeploymentSummary> {
    requireOverwriteConfirmation(body);
    return this.startRecovery(
      caller,
      requestId,
      projectId,
      rawDeploymentId,
      "retry",
    );
  }

  /** Rolls back by redeploying the latest successful saved source snapshot. */
  async rollback(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    rawDeploymentId: string,
    body: unknown,
  ): Promise<ProjectDeploymentSummary> {
    requireOverwriteConfirmation(body);
    return this.startRecovery(
      caller,
      requestId,
      projectId,
      rawDeploymentId,
      "rollback",
    );
  }

  private async startRecovery(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    rawDeploymentId: string,
    mode: "retry" | "rollback",
  ): Promise<ProjectDeploymentSummary> {
    const project = await this.projectService.getProject(
      caller,
      requestId,
      projectId,
    );
    requireEditor(project.callerRole);
    const actor = toProjectActor(caller, this.workspaceId, requestId);
    const sourceId = validateProjectDeploymentId(rawDeploymentId);
    const appSpaceName =
      await this.workspaceClient.getInstalledAppSpace(caller);
    const record = await this.repository.createRecoveryDeployment(
      projectId,
      actor,
      sourceId,
      mode,
      requestId,
    );
    const childApp = await this.repository.getChildApp(projectId, actor);
    return this.deploySnapshot(
      caller,
      requestId,
      actor,
      projectId,
      record,
      childApp?.createMarker ?? null,
      appSpaceName,
    );
  }

  private async deploySnapshot(
    caller: CallerIdentity,
    requestId: string,
    actor: ReturnType<typeof toProjectActor>,
    projectId: string,
    record: ProjectDeploymentRecord,
    createMarker: string | null,
    appSpaceName: string | null,
  ): Promise<ProjectDeploymentSummary> {
    const sourceCodePath = createDeploymentSourcePath(
      caller,
      projectId,
      record.id,
    );
    validateGeneratedSource(sourceCodePath, record.sourceFiles);
    let savedRecord = await this.repository.updateDeployment(
      projectId,
      record.id,
      actor,
      {
        action: "deployment.source_path.reserved",
        sourceCodePath,
      },
    );
    savedRecord ??= record;

    try {
      const target = await this.targetService.ensureTargetApp(
        caller,
        savedRecord,
        createMarker,
        appSpaceName,
      );
      const app = target.app;
      this.targetService.validateExistingApp(
        app,
        savedRecord.requiredUserApiScopes,
        savedRecord.requiredAppResources,
        savedRecord.appId,
        appSpaceName,
      );
      if (app.appId && app.appId !== savedRecord.appId) {
        savedRecord = await this.requireUpdatedRecord(
          projectId,
          savedRecord.id,
          actor,
          {
            action: target.auditAction ?? "deployment.app.linked",
            appId: app.appId,
          },
        );
      }
      await this.workspaceClient.uploadSource(
        caller,
        sourceCodePath,
        savedRecord.sourceFiles,
      );
      const remote = await this.workspaceClient.createDeployment(
        caller,
        savedRecord.appName,
        sourceCodePath,
      );
      const finalRecord = await this.requireUpdatedRecord(
        projectId,
        savedRecord.id,
        actor,
        {
          action: "deployment.submitted",
          deploymentId: remote.deploymentId,
          status: remote.state,
          failureCode:
            remote.state === "failed" ? "workspace_deployment_failed" : null,
        },
      );
      return toSummary(finalRecord);
    } catch (error) {
      await this.repository.updateDeployment(projectId, savedRecord.id, actor, {
        action: "deployment.failed",
        status: "failed",
        failureCode: readFailureCode(error),
      });
      throw error;
    }
  }

  private async requireUpdatedRecord(
    projectId: string,
    deploymentId: string,
    actor: ReturnType<typeof toProjectActor>,
    update: Parameters<ProjectDeploymentRepository["updateDeployment"]>[3],
  ): Promise<ProjectDeploymentRecord> {
    const result = await this.repository.updateDeployment(
      projectId,
      deploymentId,
      actor,
      update,
    );
    if (!result) throw deploymentNotFound();
    return result;
  }
}

function isSecretResource(
  resource: WorkspaceAppResource,
): resource is WorkspaceSecretAppResource {
  return "secret" in resource;
}
