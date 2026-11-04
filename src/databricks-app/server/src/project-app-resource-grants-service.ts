import type { CallerIdentity, WorkspaceAppResource } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";
import type { ProjectDeploymentRepository } from "./db/project-deployment-repository.ts";
import type { ProjectService } from "./db/project-service.ts";
import type { ProjectPreviewService } from "./generation/project-preview-service.ts";
import {
  toProjectDeploymentActor,
} from "./project-deployment-contract-mapping.ts";
import {
  childAppTargetConflict,
  requireProjectDeploymentEditor,
} from "./project-deployment-service-errors.ts";
import type { WorkspaceAppDeploymentClient } from "./workspace-app-deployment-client.ts";
import {
  containsWorkspaceAppResources,
  validateWorkspaceAppResources,
} from "./workspace-app-resource-validation.ts";

/** Coordinates ACL-checked, caller-authorized child-App resource grant edits. */
export class ProjectAppResourceGrantsService {
  private readonly projectService: ProjectService;
  private readonly previewService: ProjectPreviewService;
  private readonly repository: ProjectDeploymentRepository;
  private readonly workspaceClient: WorkspaceAppDeploymentClient;
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
    this.workspaceId = workspaceId;
  }

  /** Updates resource grants without allowing required project bindings to be removed. */
  async update(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<{ appName: string; resourceCount: number }> {
    const project = await this.projectService.getProject(
      caller,
      requestId,
      projectId,
    );
    requireProjectDeploymentEditor(project.callerRole);
    const actor = toProjectDeploymentActor(
      caller,
      this.workspaceId,
      requestId,
    );
    const childApp = await this.repository.getChildApp(projectId, actor);
    if (!childApp) throw childAppTargetConflict();
    const latestDeployment = (await this.repository.listDeployments(
      projectId,
      actor,
    ))[0];
    if (!latestDeployment) throw childAppTargetConflict();
    const resources = readWorkspaceAppResourceInput(body);
    validateWorkspaceAppResources(resources);

    const source = await this.previewService.generateDeploymentSource(
      caller,
      requestId,
      projectId,
    );
    if (
      !containsWorkspaceAppResources(
        resources,
        source.requirements.appResources,
      )
    ) {
      throw new ApplicationError(
        422,
        "required_app_resource_grant_missing",
        "Project resource grant is required",
        "Keep the Databricks App resources required by the current project bindings.",
      );
    }

    const currentApp = await this.workspaceClient.getApp(
      caller,
      childApp.appName,
    );
    if (!currentApp || (childApp.appId && currentApp.appId !== childApp.appId)) {
      throw childAppTargetConflict();
    }
    if ((currentApp.unsupportedResourceCount ?? 0) > 0) {
      throw new ApplicationError(
        409,
        "unsupported_app_resources_present",
        "Resource grants need workspace review",
        "This App has resource types VDAB cannot safely edit yet. Review its complete resource list in Databricks before changing grants.",
      );
    }

    await this.workspaceClient.updateAppResources(
      caller,
      childApp.appName,
      resources,
    );
    await this.repository.updateDeployment(
      projectId,
      latestDeployment.id,
      actor,
      { action: "child_app.resource_grants.update_submitted" },
    );
    return { appName: childApp.appName, resourceCount: resources.length };
  }
}

function readWorkspaceAppResourceInput(body: unknown): WorkspaceAppResource[] {
  if (!isRecord(body) || !Array.isArray(body.resources) || body.resources.length > 100) {
    throw invalidResourceGrantInput();
  }
  const resources = body.resources;
  if (!resources.every(isSupportedWorkspaceAppResource)) {
    throw invalidResourceGrantInput();
  }
  return resources;
}

function isSupportedWorkspaceAppResource(
  value: unknown,
): value is WorkspaceAppResource {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.description !== "string"
  ) {
    return false;
  }
  if (
    isRecord(value.secret) &&
    hasOnlyResourceKeys(value, "secret") &&
    hasOnlyKeys(value.secret, ["scope", "key", "permission"])
  ) {
    return (
      typeof value.secret.scope === "string" &&
      typeof value.secret.key === "string" &&
      ["READ", "WRITE", "MANAGE"].includes(
        String(value.secret.permission),
      )
    );
  }
  if (
    isRecord(value.sql_warehouse) &&
    hasOnlyResourceKeys(value, "sql_warehouse") &&
    hasOnlyKeys(value.sql_warehouse, ["id", "permission"])
  ) {
    return (
      typeof value.sql_warehouse.id === "string" &&
      ["CAN_USE", "CAN_MANAGE", "IS_OWNER"].includes(
        String(value.sql_warehouse.permission),
      )
    );
  }
  if (
    isRecord(value.postgres) &&
    hasOnlyResourceKeys(value, "postgres") &&
    hasOnlyKeys(value.postgres, ["database", "permission"])
  ) {
    return (
      typeof value.postgres.database === "string" &&
      value.postgres.permission === "CAN_CONNECT_AND_CREATE"
    );
  }
  if (
    isRecord(value.database) &&
    hasOnlyResourceKeys(value, "database") &&
    hasOnlyKeys(value.database, ["instance_name", "database_name", "permission"])
  ) {
    return (
      typeof value.database.instance_name === "string" &&
      typeof value.database.database_name === "string" &&
      value.database.permission === "CAN_CONNECT_AND_CREATE"
    );
  }
  return false;
}

function hasOnlyResourceKeys(
  value: Record<string, unknown>,
  resourceType: string,
): boolean {
  return (
    Object.keys(value).length === 3 &&
    Object.hasOwn(value, "name") &&
    Object.hasOwn(value, "description") &&
    Object.hasOwn(value, resourceType)
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResourceGrantInput(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_app_resource_grants",
    "Invalid App resource grants",
    "Provide a list of supported Databricks App resources with valid permission settings.",
  );
}
