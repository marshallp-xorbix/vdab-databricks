import type { AuthenticationMode } from "./WorkspaceResource";

export interface IWorkspaceTableColumn {
  name: string;
  type: string | null;
  dataType?: string | null;
}

export interface IWorkspaceTable {
  name: string;
  dataSourceFormat?: string | null;
  columns: IWorkspaceTableColumn[];
}

export interface IWorkspaceTablesPage {
  items: IWorkspaceTable[];
  authenticationMode: AuthenticationMode;
}

export class WorkspaceTable implements IWorkspaceTable {
  name: string;
  dataSourceFormat: string | null;
  columns: IWorkspaceTableColumn[];

  constructor(source: Partial<IWorkspaceTable> = {}) {
    this.name = source.name ?? "";
    this.dataSourceFormat = source.dataSourceFormat ?? null;
    this.columns = source.columns ?? [];
  }
}

export class WorkspaceTablesPage implements IWorkspaceTablesPage {
  items: WorkspaceTable[];
  authenticationMode: AuthenticationMode;

  constructor(source: Partial<IWorkspaceTablesPage> = {}) {
    this.items = (source.items ?? []).map((table) => new WorkspaceTable(table));
    this.authenticationMode = source.authenticationMode ?? "databricks";
  }
}
