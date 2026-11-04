import { ApplicationError } from "../application-error.ts";
import type { CallerIdentity } from "../contracts.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { ProjectRepository } from "./project-repository.ts";
import type {
  ProjectCustomModulesDocument,
  ProjectCustomModulesInput,
} from "./project-custom-modules-contract.ts";
import { readProjectCustomModulesInput } from "./project-custom-modules-input.ts";
import type { ProjectCustomModulesRepository } from "./project-custom-modules-repository.ts";

/** Applies project ACL and shared-version policy to custom module source. */
export class ProjectCustomModulesService {
  private readonly repository: ProjectCustomModulesRepository;
  private readonly projects: ProjectRepository;
  private readonly workspaceId: string;

  constructor(
    repository: ProjectCustomModulesRepository,
    projects: ProjectRepository,
    workspaceId: string,
  ) {
    this.repository = repository;
    this.projects = projects;
    this.workspaceId = workspaceId;
  }

  /** Returns the source file when the caller can access the project. */
  async getCustomModules(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectCustomModulesDocument> {
    const document = await this.repository.getCustomModules(projectId, toActor(caller, this.workspaceId, requestId));
    if (!document) throw projectNotFound();
    return document;
  }

  /** Saves the source file for project editors using the current project version. */
  async replaceCustomModules(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<ProjectCustomModulesDocument> {
    const input: ProjectCustomModulesInput = readProjectCustomModulesInput(body);
    const project = await this.projects.getProject(projectId, toActor(caller, this.workspaceId, requestId));
    if (!project) throw projectNotFound();
    if (project.callerRole !== "owner" && project.callerRole !== "editor" && project.callerRole !== "installationAdmin") {
      throw new ApplicationError(403, "project_edit_permission_required", "Project edit permission required", "Only project editors can update custom Python modules.");
    }
    const document = await this.repository.replaceCustomModules(
      projectId,
      input.expectedVersion,
      input.source,
      toActor(caller, this.workspaceId, requestId),
    );
    if (!document) throw projectNotFound();
    return document;
  }
}

function toActor(caller: CallerIdentity, workspaceId: string, requestId: string): ProjectActor {
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
