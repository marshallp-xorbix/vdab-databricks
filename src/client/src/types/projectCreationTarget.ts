import type { ProjectChildAppMode } from "../models/ProjectDeployments";

export interface ProjectCreationTarget {
  mode: ProjectChildAppMode;
  appName: string;
}
