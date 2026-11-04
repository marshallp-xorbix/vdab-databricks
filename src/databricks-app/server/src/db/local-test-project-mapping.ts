import type { ProjectSummary } from "../contracts.ts";
import type { ProjectActor } from "./project-repository.ts";

/** Converts an in-memory project into the caller-specific API summary. */
export function mapLocalTestProjectSummary(
  project: ProjectSummary & { workspaceId: string },
  actor: ProjectActor,
  isCollaborator: boolean,
): ProjectSummary {
  let callerRole: ProjectSummary["callerRole"];

  if (project.createdBy === actor.userId) {
    callerRole = "owner";
  } else if (actor.isInstallationAdmin) {
    callerRole = "installationAdmin";
  } else if (isCollaborator) {
    callerRole = "editor";
  } else {
    callerRole = "viewer";
  }

  const { workspaceId: _workspaceId, ...summary } = project;
  return { ...summary, callerRole };
}
