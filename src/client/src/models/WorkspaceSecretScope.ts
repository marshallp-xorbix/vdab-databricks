import type { AuthenticationMode } from "./WorkspaceResource";

export interface IWorkspaceSecretScope {
  name: string;
}

export interface IWorkspaceSecretScopesPage {
  items: IWorkspaceSecretScope[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceSecretScope implements IWorkspaceSecretScope {
  name: string;

  constructor(source: Partial<IWorkspaceSecretScope> = {}) {
    this.name = source.name ?? "";
  }
}

export class WorkspaceSecretScopesPage implements IWorkspaceSecretScopesPage {
  items: WorkspaceSecretScope[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceSecretScopesPage> = {}) {
    this.items = (source.items ?? []).map((item) => new WorkspaceSecretScope(item));
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
