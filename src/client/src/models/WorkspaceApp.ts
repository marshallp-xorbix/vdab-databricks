export type AuthenticationMode = "databricks" | "local-test";

export interface IWorkspaceAppSummary {
  url?: string | null;
  name: string;
  description: string | null;
  appState: string | null;
  computeState: string | null;
}

export class WorkspaceAppSummary implements IWorkspaceAppSummary {
  url?: string | null;
  name: string;
  description: string | null;
  appState: string | null;
  computeState: string | null;

  constructor(source: Partial<IWorkspaceAppSummary> = {}) {
    this.name = source.name ?? "";
    this.url = source.url;
    this.description = source.description ?? null;
    this.appState = source.appState ?? null;
    this.computeState = source.computeState ?? null;
  }
}

export interface IWorkspaceAppsPage {
  items: IWorkspaceAppSummary[];
  nextPageToken: string | null;
  authenticationMode: AuthenticationMode;
}

export class WorkspaceAppsPage implements IWorkspaceAppsPage {
  items: WorkspaceAppSummary[];
  nextPageToken: string | null;
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceAppsPage> = {}) {
    this.items = (source.items ?? []).map(
      (item) => new WorkspaceAppSummary(item),
    );
    this.nextPageToken = source.nextPageToken ?? null;
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
