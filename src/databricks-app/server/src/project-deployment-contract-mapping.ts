import type {
  CallerIdentity,
  ProjectChildAppLink,
  ProjectDeploymentSummary,
} from "./contracts.ts";
import type {
  ProjectChildAppRecord,
  ProjectDeploymentRecord,
} from "./db/project-deployment-repository.ts";
import type { ProjectActor } from "./db/project-repository.ts";

/** Creates repository actor context from the trusted caller and workspace. */
export function toProjectDeploymentActor(
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

/** Maps a private child-App record to its public contract. */
export function toPublicChildApp(
  childApp: ProjectChildAppRecord,
): ProjectChildAppLink {
  return {
    appId: childApp.appId,
    appName: childApp.appName,
    mode: childApp.mode,
    sourceCodePath: childApp.sourceCodePath,
  };
}

/** Maps a private deployment snapshot to its public history shape. */
export function toProjectDeploymentSummary(
  record: ProjectDeploymentRecord,
): ProjectDeploymentSummary {
  return {
    id: record.id,
    projectId: record.projectId,
    appName: record.appName,
    mode: record.mode,
    sourceVersion: record.sourceVersion,
    status: record.status,
    deploymentId: record.deploymentId,
    sourceCodePath: record.sourceCodePath,
    failureCode: record.failureCode,
    attemptOf: record.attemptOf,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}
