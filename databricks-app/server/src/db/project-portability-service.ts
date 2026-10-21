import type { CallerIdentity } from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";
import { readComponentsInput } from "./project-components-input.ts";
import { readProjectCustomModulesInput } from "./project-custom-modules-input.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { ProjectImportResult, StandaloneProjectExport } from "./project-portability-contract.ts";
import { createStandaloneProjectExport, readStandaloneProjectImport } from "./project-portability-input.ts";
import type { ProjectPortabilityRepository } from "./project-portability-repository.ts";
import { readProjectWorkflowInput } from "./project-workflow-input.ts";

/** Coordinates ACL-checked project portability operations for this installation. */
export class ProjectPortabilityService {
  private readonly repository: ProjectPortabilityRepository;
  private readonly workspaceId: string;

  constructor(repository: ProjectPortabilityRepository, workspaceId: string) {
    this.repository = repository;
    this.workspaceId = workspaceId;
  }

  /** Exports a consistent, ACL-authorized project without workspace authority. */
  async exportProject(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<StandaloneProjectExport> {
    const snapshot = await this.repository.getProjectAggregate(
      projectId,
      toProjectActor(caller, this.workspaceId, requestId),
    );
    if (!snapshot) throw projectNotFound();

    const components = readComponentsInput({ version: 1, components: snapshot.components }).components;
    const workflow = readProjectWorkflowInput({ version: 1, workflow: snapshot.workflow }).workflow;
    const customModulesSource = readProjectCustomModulesInput({
      expectedVersion: 1,
      source: snapshot.customModulesSource,
    }).source;

    return createStandaloneProjectExport({
      name: snapshot.project.name,
      description: snapshot.project.description,
      theme: snapshot.theme,
      customModulesSource,
      components,
      workflow,
      resourceReferences: snapshot.resourceReferences,
      childAppDisplayName: snapshot.childAppDisplayName,
    });
  }

  /** Imports a validated standalone project as a new caller-owned aggregate. */
  async importProject(
    caller: CallerIdentity,
    requestId: string,
    body: unknown,
  ): Promise<ProjectImportResult> {
    const aggregate = readStandaloneProjectImport(body);
    const project = await this.repository.importProjectAggregate(
      aggregate,
      toProjectActor(caller, this.workspaceId, requestId),
    );
    return {
      project,
      unresolvedResources: aggregate.resourceReferences,
      requiresChildAppSelection: true,
    };
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
  return new ApplicationError(
    404,
    "project_not_found",
    "Project not found",
    "The requested project does not exist or is not available to you.",
  );
}
