import type { AuthenticationMode } from "./WorkspaceResource";

export interface IWorkspaceGenieSpace {
  spaceId: string;
  title: string;
}

export interface IWorkspaceGenieSpacesPage {
  items: IWorkspaceGenieSpace[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceGenieSpace implements IWorkspaceGenieSpace {
  spaceId: string;
  title: string;

  constructor(source: Partial<IWorkspaceGenieSpace> = {}) {
    this.spaceId = source.spaceId ?? "";
    this.title = source.title ?? "";
  }
}

export class WorkspaceGenieSpacesPage implements IWorkspaceGenieSpacesPage {
  items: WorkspaceGenieSpace[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceGenieSpacesPage> = {}) {
    this.items = (source.items ?? []).map((space) => new WorkspaceGenieSpace(space));
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
