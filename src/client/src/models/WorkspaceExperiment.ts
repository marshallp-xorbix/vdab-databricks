import type { AuthenticationMode } from "./WorkspaceResource";

export interface IWorkspaceExperiment {
  experimentId: string;
  name: string;
}

export interface IWorkspaceExperimentsPage {
  items: IWorkspaceExperiment[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceExperiment implements IWorkspaceExperiment {
  experimentId: string;
  name: string;

  constructor(source: Partial<IWorkspaceExperiment> = {}) {
    this.experimentId = source.experimentId ?? "";
    this.name = source.name ?? "";
  }
}

export class WorkspaceExperimentsPage implements IWorkspaceExperimentsPage {
  items: WorkspaceExperiment[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceExperimentsPage> = {}) {
    this.items = (source.items ?? []).map((item) => new WorkspaceExperiment(item));
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
