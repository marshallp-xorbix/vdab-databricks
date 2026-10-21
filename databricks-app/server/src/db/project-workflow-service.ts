import { ApplicationError } from "../application-error.ts";
import type { CallerIdentity } from "../contracts.ts";
import type { ComponentRegistryService } from "../component-registry/component-registry-service.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { ProjectComponentsService } from "./project-components-service.ts";
import type { ProjectWorkflowDocument } from "./project-workflow-contract.ts";
import { validateProjectWorkflowComponentReferences } from "./project-workflow-component-references.ts";
import { readProjectWorkflowInput } from "./project-workflow-input.ts";
import type { ProjectWorkflowRepository } from "./project-workflow-repository.ts";

/** Validates and coordinates workflow reads and atomic project saves. */
export class ProjectWorkflowService {
  private readonly repository: ProjectWorkflowRepository;
  private readonly workspaceId: string;
  private readonly componentsService: ProjectComponentsService;
  private readonly registryService: ComponentRegistryService;

  constructor(
    repository: ProjectWorkflowRepository,
    workspaceId: string,
    componentsService: ProjectComponentsService,
    registryService: ComponentRegistryService,
  ) {
    this.repository = repository;
    this.workspaceId = workspaceId;
    this.componentsService = componentsService;
    this.registryService = registryService;
  }

  /** Returns a project workflow document after repository ACL checks. */
  async getWorkflow(caller: CallerIdentity, requestId: string, projectId: string): Promise<ProjectWorkflowDocument> {
    const document = await this.repository.getWorkflow(projectId, toProjectActor(caller, this.workspaceId, requestId));
    if (!document) throw projectNotFound();
    return document;
  }

  /** Replaces the complete ordered workflow aggregate at the supplied project version. */
  async replaceWorkflow(caller: CallerIdentity, requestId: string, projectId: string, body: unknown): Promise<ProjectWorkflowDocument> {
    const input = readProjectWorkflowInput(body);
    const components = await this.componentsService.getComponents(caller, requestId, projectId);
    if (components.version !== input.expectedVersion) throw projectVersionConflict();
    validateProjectWorkflowComponentReferences(
      input.workflow,
      components.components,
      this.registryService.getRegistry().components,
    );
    const document = await this.repository.replaceWorkflow(
      projectId,
      input.expectedVersion,
      input.workflow,
      toProjectActor(caller, this.workspaceId, requestId),
    );
    if (!document) throw projectNotFound();
    return document;
  }
}

function toProjectActor(caller: CallerIdentity, workspaceId: string, requestId: string): ProjectActor {
  return {
    workspaceId,
    userId: caller.userId,
    isInstallationAdmin: caller.isInstallationAdmin,
    requestId,
  };
}

function projectNotFound(): ApplicationError {
  return new ApplicationError(404, "project_not_found", "Project not found", "The requested project does not exist or is not available to you.");
}

function projectVersionConflict(): ApplicationError {
  return new ApplicationError(409, "project_version_conflict", "Project changed", "This project was updated by another user. Reload it before saving again.");
}
