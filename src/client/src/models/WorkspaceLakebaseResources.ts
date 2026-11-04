export interface IWorkspaceLakebaseProject {
  projectId: string;
  displayName: string;
}

export interface IWorkspaceLakebaseBranch {
  branchId: string;
  isDefault: boolean;
  state: "ready" | "initializing" | "archived" | "unknown";
}

export interface IWorkspaceLakebaseEndpoint {
  endpointId: string;
  endpointType: "read-write" | "read-only";
  state: "active" | "idle" | "initializing" | "degraded" | "unknown";
}

export interface IWorkspaceLakebaseDatabase {
  databaseId: string;
  databaseName: string;
}

export interface IWorkspaceLakebaseProvisionedInstance {
  instanceName: string;
  state: string | null;
}

export interface IWorkspaceLakebaseTable {
  name: string;
  tableType: "BASE TABLE" | "VIEW";
  columns: IWorkspaceLakebaseColumn[];
}

export interface IWorkspaceLakebaseColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface IWorkspaceLakebaseResourcePage<T> {
  items: T[];
  authenticationMode: "databricks" | "local-test";
}

export type LakebaseMetadataSelection = Readonly<{
  projectId: string;
  branchId: string;
  endpointId: string;
  databaseName: string;
}>;

export type LakebaseProvisionedMetadataSelection = Readonly<{
  instanceName: string;
  databaseName: string;
}>;

export class WorkspaceLakebaseResourcePage<T> implements IWorkspaceLakebaseResourcePage<T> {
  items: T[];
  authenticationMode: "databricks" | "local-test";

  constructor(source: Partial<IWorkspaceLakebaseResourcePage<T>> = {}) {
    this.items = source.items ?? [];
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
