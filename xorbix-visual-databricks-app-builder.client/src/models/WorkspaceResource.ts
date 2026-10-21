export type AuthenticationMode = "databricks" | "local-test";

export interface IWorkspaceResource {
  name: string;
}

export class WorkspaceResource implements IWorkspaceResource {
  name: string;

  constructor(source: Partial<IWorkspaceResource> = {}) {
    this.name = source.name ?? "";
  }
}

export interface IWorkspaceResourcesPage {
  items: IWorkspaceResource[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceResourcesPage implements IWorkspaceResourcesPage {
  items: WorkspaceResource[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceResourcesPage> = {}) {
    this.items = (source.items ?? []).map((item) => new WorkspaceResource(item));
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
