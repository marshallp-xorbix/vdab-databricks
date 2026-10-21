import { ApplicationError } from "../application-error.ts";
import type { CallerIdentity } from "../contracts.ts";
import type { ProjectActor } from "./project-repository.ts";
import type { ProjectComponentsDocument } from "./project-components-contract.ts";
import type { ProjectComponentsRepository } from "./project-components-repository.ts";
import { readComponentsInput } from "./project-components-input.ts";
/** Validates and coordinates project component reads and atomic replacements. */
export class ProjectComponentsService {
  private readonly repository: ProjectComponentsRepository;
  private readonly workspaceId: string;

  constructor(repository: ProjectComponentsRepository, workspaceId: string) {
    this.repository = repository;
    this.workspaceId = workspaceId;
  }

  /** Returns the ordered project-local component collection visible to the caller. */
  async getComponents(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectComponentsDocument> {
    const document = await this.repository.getComponents(
      projectId,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!document) {
      throw projectNotFound();
    }

    return document;
  }

  /** Replaces the ordered collection using optimistic project versioning. */
  async replaceComponents(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<ProjectComponentsDocument> {
    const input = readComponentsInput(body);
    const document = await this.repository.replaceComponents(
      projectId,
      input.expectedVersion,
      input.components,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!document) {
      throw projectNotFound();
    }

    return document;
  }
}

function toProjectActor(
  caller: CallerIdentity,
  workspaceId: string,
  requestId: string,
): ProjectActor {
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
