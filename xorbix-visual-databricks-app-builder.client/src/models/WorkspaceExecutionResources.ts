import type { AuthenticationMode } from "./WorkspaceResource";

export interface IWorkspaceJob {
  jobId: string;
  name: string;
}

export interface IWorkspaceJobsPage {
  items: IWorkspaceJob[];
  authenticationMode: AuthenticationMode;
}

export interface IWorkspaceSqlWarehouse {
  id: string;
  name: string;
  state: "running" | "stopped" | "starting" | "stopping" | "unknown";
}

export interface IWorkspaceSqlWarehousesPage {
  items: IWorkspaceSqlWarehouse[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceJobsPage implements IWorkspaceJobsPage {
  items: IWorkspaceJob[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceJobsPage> = {}) {
    this.items = source.items ?? [];
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}

export class WorkspaceSqlWarehousesPage implements IWorkspaceSqlWarehousesPage {
  items: IWorkspaceSqlWarehouse[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceSqlWarehousesPage> = {}) {
    this.items = source.items ?? [];
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
