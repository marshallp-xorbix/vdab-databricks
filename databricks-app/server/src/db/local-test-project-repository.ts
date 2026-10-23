import { randomUUID } from "node:crypto";
import type { ProjectCollaborator, ProjectSummary } from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "./project-components-contract.ts";
import type { ProjectComponentsRepository } from "./project-components-repository.ts";
import type {
  ProjectWorkflow,
  ProjectWorkflowDefinition,
  ProjectWorkflowDocument,
} from "./project-workflow-contract.ts";
import type { ProjectWorkflowRepository } from "./project-workflow-repository.ts";
import type { ProjectCustomModulesDocument } from "./project-custom-modules-contract.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "./project-custom-modules-contract.ts";
import type { ProjectCustomModulesRepository } from "./project-custom-modules-repository.ts";
import { mapLocalTestProjectSummary } from "./local-test-project-mapping.ts";
import { LocalTestProjectCollaborators } from "./local-test-project-collaborators.ts";
import type {
  NewProject,
  ProjectActor,
  ProjectMetadata,
  ProjectRepository,
} from "./project-repository.ts";
import type {
  ImportedProjectAggregate,
  PortableResourceReference,
  ProjectAggregateSnapshot,
} from "./project-portability-contract.ts";
import type { ProjectPortabilityRepository } from "./project-portability-repository.ts";

/** In-memory project adapter for explicit, non-production local-test mode. */
export class LocalTestProjectRepository
  implements
    ProjectRepository,
    ProjectComponentsRepository,
    ProjectWorkflowRepository,
    ProjectCustomModulesRepository,
    ProjectPortabilityRepository
{
  private readonly projects = new Map<
    string,
    ProjectSummary & { workspaceId: string }
  >();
  private readonly collaborators = new Map<string, ProjectCollaborator[]>();
  private readonly collaboratorRepository = new LocalTestProjectCollaborators(
    this.projects,
    this.collaborators,
  );
  private readonly projectComponents = new Map<string, ProjectComponent[]>();
  private readonly projectWorkflows = new Map<string, ProjectWorkflow[]>();
  private readonly projectCustomModules = new Map<string, string>();
  private readonly projectThemes = new Map<
    string,
    Record<string, unknown> | null
  >();
  private readonly projectResourceReferences = new Map<
    string,
    PortableResourceReference[]
  >();

  async createProject(input: NewProject): Promise<ProjectSummary> {
    const duplicateName = [...this.projects.values()].some(
      (project) =>
        project.workspaceId === input.workspaceId &&
        project.name === input.name,
    );

    if (duplicateName) {
      throw new ApplicationError(
        409,
        "project_name_conflict",
        "Project name already exists",
        "Choose another project name in this workspace.",
      );
    }

    const project: ProjectSummary & { workspaceId: string } = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      version: 1,
      createdBy: input.actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      callerRole: "owner",
      workspaceId: input.workspaceId,
    };

    this.projects.set(project.id, project);
    return project;
  }

  async listProjects(actor: ProjectActor): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .filter(
        (project) =>
          project.workspaceId === actor.workspaceId &&
          (project.createdBy === actor.userId ||
            this.hasCollaborator(project.id, actor.userId) ||
            actor.isInstallationAdmin),
      )
      .map((project) => this.toProjectSummary(project, actor));
  }

  async getProject(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null> {
    const project = this.projects.get(projectId);

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !this.hasCollaborator(project.id, actor.userId) &&
        !actor.isInstallationAdmin)
    ) {
      return null;
    }

    return this.toProjectSummary(project, actor);
  }

  async getProjectAggregate(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectAggregateSnapshot | null> {
    const project = this.projects.get(projectId);
    if (!this.collaboratorRepository.canReadProject(project, projectId, actor))
      return null;
    return {
      project: this.toProjectSummary(project, actor),
      theme: structuredClone(this.projectThemes.get(projectId) ?? null),
      components: structuredClone(this.projectComponents.get(projectId) ?? []),
      workflow: {
        version: 1,
        workflows: structuredClone(this.projectWorkflows.get(projectId) ?? []),
      },
      customModulesSource:
        this.projectCustomModules.get(projectId) ??
        DEFAULT_CUSTOM_MODULES_SOURCE,
      resourceReferences: structuredClone(
        this.projectResourceReferences.get(projectId) ?? [],
      ),
      childAppDisplayName: null,
    };
  }

  async importProjectAggregate(
    aggregate: ImportedProjectAggregate,
    actor: ProjectActor,
  ): Promise<ProjectSummary> {
    const duplicateName = [...this.projects.values()].some(
      (project) =>
        project.workspaceId === actor.workspaceId &&
        project.name === aggregate.name,
    );
    if (duplicateName) {
      throw new ApplicationError(
        409,
        "project_name_conflict",
        "Project name already exists",
        "Choose another project name in this workspace.",
      );
    }

    const project = await this.createProject({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      name: aggregate.name,
      description: aggregate.description,
      requestId: actor.requestId,
    });
    this.projectThemes.set(project.id, structuredClone(aggregate.theme));
    this.projectComponents.set(
      project.id,
      structuredClone(aggregate.components),
    );
    this.projectWorkflows.set(
      project.id,
      structuredClone(aggregate.workflow.workflows),
    );
    this.projectCustomModules.set(project.id, aggregate.customModulesSource);
    this.projectResourceReferences.set(
      project.id,
      structuredClone(aggregate.resourceReferences),
    );
    return project;
  }

  async updateProject(
    projectId: string,
    metadata: ProjectMetadata,
    actor: ProjectActor,
  ): Promise<ProjectSummary | null> {
    const project = this.projects.get(projectId);

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !this.hasCollaborator(project.id, actor.userId) &&
        !actor.isInstallationAdmin)
    ) {
      return null;
    }

    if (project.version !== metadata.expectedVersion) {
      throw new ApplicationError(
        409,
        "project_version_conflict",
        "Project changed",
        "This project was updated by another user. Reload it before saving again.",
      );
    }

    const duplicateName = [...this.projects.values()].some(
      (candidate) =>
        candidate.id !== projectId &&
        candidate.workspaceId === actor.workspaceId &&
        candidate.name === metadata.name,
    );

    if (duplicateName) {
      throw new ApplicationError(
        409,
        "project_name_conflict",
        "Project name already exists",
        "Choose another project name in this workspace.",
      );
    }

    project.name = metadata.name;
    project.description = metadata.description;
    project.version += 1;
    project.updatedAt = new Date().toISOString();
    this.projects.set(projectId, project);

    return this.toProjectSummary(project, actor);
  }

  async deleteProject(
    projectId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    const project = this.projects.get(projectId);

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId && !actor.isInstallationAdmin)
    ) {
      return false;
    }

    this.projects.delete(projectId);
    this.collaboratorRepository.removeProject(projectId);
    this.projectComponents.delete(projectId);
    this.projectWorkflows.delete(projectId);
    this.projectCustomModules.delete(projectId);
    this.projectThemes.delete(projectId);
    this.projectResourceReferences.delete(projectId);
    return true;
  }

  async getComponents(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument | null> {
    const project = this.projects.get(projectId);

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !this.hasCollaborator(projectId, actor.userId) &&
        !actor.isInstallationAdmin)
    ) {
      return null;
    }

    return {
      projectId,
      version: project.version,
      components: structuredClone(this.projectComponents.get(projectId) ?? []),
    };
  }

  async replaceComponents(
    projectId: string,
    expectedVersion: number,
    components: ProjectComponent[],
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument | null> {
    const project = this.projects.get(projectId);

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !this.hasCollaborator(projectId, actor.userId) &&
        !actor.isInstallationAdmin)
    ) {
      return null;
    }

    if (project.version !== expectedVersion) {
      throw projectVersionConflict();
    }

    project.version += 1;
    project.updatedAt = new Date().toISOString();
    this.projectComponents.set(projectId, structuredClone(components));

    return {
      projectId,
      version: project.version,
      components: structuredClone(components),
    };
  }

  async getWorkflow(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectWorkflowDocument | null> {
    const project = this.projects.get(projectId);

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !this.hasCollaborator(projectId, actor.userId) &&
        !actor.isInstallationAdmin)
    ) {
      return null;
    }

    return {
      projectId,
      version: project.version,
      workflow: {
        version: 1,
        workflows: structuredClone(this.projectWorkflows.get(projectId) ?? []),
      },
    };
  }

  async replaceWorkflow(
    projectId: string,
    expectedVersion: number,
    workflow: ProjectWorkflowDefinition,
    actor: ProjectActor,
  ): Promise<ProjectWorkflowDocument | null> {
    const project = this.projects.get(projectId);
    const isEditor =
      this.collaborators
        .get(projectId)
        ?.some(
          (collaborator) =>
            collaborator.userId === actor.userId &&
            collaborator.role === "editor",
        ) ?? false;

    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !isEditor &&
        !actor.isInstallationAdmin)
    ) {
      return null;
    }

    if (project.version !== expectedVersion) throw projectVersionConflict();

    project.version += 1;
    project.updatedAt = new Date().toISOString();
    this.projectWorkflows.set(projectId, structuredClone(workflow.workflows));

    return {
      projectId,
      version: project.version,
      workflow: structuredClone(workflow),
    };
  }

  async getCustomModules(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCustomModulesDocument | null> {
    const project = this.projects.get(projectId);
    if (!this.collaboratorRepository.canReadProject(project, projectId, actor))
      return null;
    return {
      projectId,
      version: project.version,
      source:
        this.projectCustomModules.get(projectId) ??
        DEFAULT_CUSTOM_MODULES_SOURCE,
    };
  }

  async replaceCustomModules(
    projectId: string,
    expectedVersion: number,
    source: string,
    actor: ProjectActor,
  ): Promise<ProjectCustomModulesDocument | null> {
    const project = this.projects.get(projectId);
    const isEditor =
      this.collaborators
        .get(projectId)
        ?.some(
          (collaborator) =>
            collaborator.userId === actor.userId &&
            collaborator.role === "editor",
        ) ?? false;
    if (
      !project ||
      project.workspaceId !== actor.workspaceId ||
      (project.createdBy !== actor.userId &&
        !isEditor &&
        !actor.isInstallationAdmin)
    )
      return null;
    if (project.version !== expectedVersion) throw projectVersionConflict();

    project.version += 1;
    project.updatedAt = new Date().toISOString();
    this.projectCustomModules.set(projectId, source);
    return { projectId, version: project.version, source };
  }

  async listCollaborators(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCollaborator[] | null> {
    return this.collaboratorRepository.list(projectId, actor);
  }

  async grantEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    return this.collaboratorRepository.grantEditor(
      projectId,
      collaboratorId,
      actor,
    );
  }

  async removeEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    return this.collaboratorRepository.removeEditor(
      projectId,
      collaboratorId,
      actor,
    );
  }

  private hasCollaborator(projectId: string, userId: string): boolean {
    return this.collaboratorRepository.hasCollaborator(projectId, userId);
  }

  private toProjectSummary(
    project: ProjectSummary & { workspaceId: string },
    actor: ProjectActor,
  ): ProjectSummary {
    return mapLocalTestProjectSummary(
      project,
      actor,
      this.hasCollaborator(project.id, actor.userId),
    );
  }
}

function projectVersionConflict(): ApplicationError {
  return new ApplicationError(
    409,
    "project_version_conflict",
    "Project changed",
    "This project was updated by another user. Reload it before saving again.",
  );
}
