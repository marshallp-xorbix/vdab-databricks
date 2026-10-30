import type { ProjectChildAppMode } from "./ProjectDeployments";

/** Persisted deployment choices for one workspace-local project. */
export interface IProjectDeploymentSettings {
  mode: ProjectChildAppMode;
  appName: string;
  workspacePath: string | null;
}

export class ProjectDeploymentSettings implements IProjectDeploymentSettings {
  mode: ProjectChildAppMode;
  appName: string;
  workspacePath: string | null;

  constructor(source: Partial<IProjectDeploymentSettings> = {}) {
    this.mode = source.mode ?? "createNew";
    this.appName = source.appName ?? "";
    this.workspacePath = source.workspacePath ?? null;
  }
}
