import type { ProjectCollaborator, ProjectSummary } from "../contracts.ts";
import type { ProjectActor } from "./project-repository.ts";

type LocalTestProject = ProjectSummary & { workspaceId: string };

/** Keeps the in-memory collaborator grant rules out of the project adapter. */
export class LocalTestProjectCollaborators {
  private readonly projects: Map<string, LocalTestProject>;
  private readonly collaborators: Map<string, ProjectCollaborator[]>;

  constructor(
    projects: Map<string, LocalTestProject>,
    collaborators: Map<string, ProjectCollaborator[]>,
  ) {
    this.projects = projects;
    this.collaborators = collaborators;
  }

  async list(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectCollaborator[] | null> {
    const project = this.projects.get(projectId);
    if (!this.canManage(project, actor)) return null;
    return [...(this.collaborators.get(projectId) ?? [])];
  }

  async grantEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!this.canManage(project, actor)) return false;

    const grants = this.collaborators.get(projectId) ?? [];
    const newGrant: ProjectCollaborator = {
      userId: collaboratorId,
      role: "editor",
      grantedBy: actor.userId,
      createdAt: new Date().toISOString(),
    };
    const existingIndex = grants.findIndex(
      (grant) => grant.userId === collaboratorId,
    );

    if (existingIndex >= 0) {
      grants[existingIndex] = newGrant;
    } else {
      grants.push(newGrant);
    }
    this.collaborators.set(projectId, grants);
    return true;
  }

  async removeEditor(
    projectId: string,
    collaboratorId: string,
    actor: ProjectActor,
  ): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!this.canManage(project, actor)) return false;

    const grants = this.collaborators.get(projectId) ?? [];
    this.collaborators.set(
      projectId,
      grants.filter((grant) => grant.userId !== collaboratorId),
    );
    return true;
  }

  hasCollaborator(projectId: string, userId: string): boolean {
    return (this.collaborators.get(projectId) ?? []).some(
      (grant) => grant.userId === userId,
    );
  }

  canReadProject(
    project: LocalTestProject | undefined,
    projectId: string,
    actor: ProjectActor,
  ): project is LocalTestProject {
    return Boolean(
      project &&
      project.workspaceId === actor.workspaceId &&
      (project.createdBy === actor.userId ||
        this.hasCollaborator(projectId, actor.userId) ||
        actor.isInstallationAdmin),
    );
  }

  removeProject(projectId: string): void {
    this.collaborators.delete(projectId);
  }

  private canManage(
    project: LocalTestProject | undefined,
    actor: ProjectActor,
  ): project is LocalTestProject {
    return Boolean(
      project &&
      project.workspaceId === actor.workspaceId &&
      (project.createdBy === actor.userId || actor.isInstallationAdmin),
    );
  }
}
