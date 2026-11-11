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
    const expectedUpdateTime = readExpectedUpdateTime(body);
    validateWorkspaceAppResources(resources);

    const currentApp = await this.workspaceClient.getApp(
      caller,
      childApp.appName,
    );
    if (!currentApp || (childApp.appId && currentApp.appId !== childApp.appId)) {
      throw childAppTargetConflict();
    }
    const source = await this.previewService.generateDeploymentSource(
      caller,
      requestId,
      projectId,
      currentApp.resources,
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
    if ((currentApp.unsupportedResourceCount ?? 0) > 0) {
      throw new ApplicationError(
        409,
        "unsupported_app_resources_present",
        "Resource grants need workspace review",
        "This App has resource types VDAB cannot safely edit yet. Review its complete resource list in Databricks before changing grants.",
      );
    }

    if (
      currentApp.appUpdateTime &&
      expectedUpdateTime &&
      currentApp.appUpdateTime !== expectedUpdateTime
    ) {
      throw new ApplicationError(
        409,
        "app_resources_conflict",
        "App resources changed",
        "The App resources changed in Databricks. Reload from Databricks and try again.",
      );
    }

    await this.workspaceClient.updateAppResources(
      caller,
      childApp.appName,
      resources,
      expectedUpdateTime,
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

function readExpectedUpdateTime(body: unknown): string | null {
  if (!isRecord(body) || body.expectedUpdateTime === undefined || body.expectedUpdateTime === null) {
    return null;
  }
  if (typeof body.expectedUpdateTime !== "string" || body.expectedUpdateTime.length > 200) {
    throw invalidResourceGrantInput();
  }
  return body.expectedUpdateTime;
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
    (hasOnlyKeys(value.postgres, ["database", "permission"]) || hasOnlyKeys(value.postgres, ["branch", "database", "permission"]))
  ) {
    return (
      typeof value.postgres.database === "string" &&
      (value.postgres.branch === undefined || typeof value.postgres.branch === "string") &&
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
  if (isRecord(value.job) && hasOnlyResourceKeys(value, "job") && hasOnlyKeys(value.job, ["id", "permission"])) {
    return typeof value.job.id === "string" && ["CAN_VIEW", "CAN_MANAGE_RUN", "CAN_MANAGE", "IS_OWNER"].includes(String(value.job.permission));
  }
  if (isRecord(value.experiment) && hasOnlyResourceKeys(value, "experiment") && hasOnlyKeys(value.experiment, ["experiment_id", "permission"])) {
    return typeof value.experiment.experiment_id === "string" && ["CAN_READ", "CAN_EDIT", "CAN_MANAGE"].includes(String(value.experiment.permission));
  }
  if (isRecord(value.genie_space) && hasOnlyResourceKeys(value, "genie_space") && hasOnlyKeys(value.genie_space, ["name", "space_id", "permission"])) {
    return typeof value.genie_space.name === "string" && typeof value.genie_space.space_id === "string" && ["CAN_VIEW", "CAN_RUN", "CAN_EDIT", "CAN_MANAGE"].includes(String(value.genie_space.permission));
  }
  if (isRecord(value.serving_endpoint) && hasOnlyResourceKeys(value, "serving_endpoint") && hasOnlyKeys(value.serving_endpoint, ["name", "permission"])) {
    return typeof value.serving_endpoint.name === "string" && ["CAN_VIEW", "CAN_QUERY", "CAN_MANAGE"].includes(String(value.serving_endpoint.permission));
  }
  if (isRecord(value.uc_securable) && hasOnlyResourceKeys(value, "uc_securable") && hasOnlyKeys(value.uc_securable, ["securable_full_name", "securable_type", "permission"])) {
    return typeof value.uc_securable.securable_full_name === "string" && ["VOLUME", "TABLE", "FUNCTION", "CONNECTION", "MODEL_SERVICE"].includes(String(value.uc_securable.securable_type)) && ["READ_VOLUME", "WRITE_VOLUME", "SELECT", "EXECUTE", "USE_CONNECTION", "MODIFY"].includes(String(value.uc_securable.permission));
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
