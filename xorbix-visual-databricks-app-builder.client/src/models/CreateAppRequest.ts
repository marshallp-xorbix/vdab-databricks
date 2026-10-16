import type { DatabricksAppResource } from "./DatabricksAppModels";

export enum DatabricksAppCreationMode {
  LinkExisting = "linkExisting",
  CreateNew = "createNew",
}

export interface ICreateAppRequest {
  /** Display name in the VDAB apps list. */
  appName: string;
  description?: string;
  /** Workspace connection primary key (tenant-scoped). */
  workspaceConnectionId: number;
  databricksAppMode: DatabricksAppCreationMode;
  /** Databricks app name to link or to create (REST `name` / canonical identifier). */
  databricksAppName?: string;
  /** When creating a new Databricks app, optional description sent to the workspace API when supported. */
  databricksAppDescription?: string;
  databricksAppResources?: DatabricksAppResource[];
  workspacePath?: string;
  workflowDefinition?: string;
}

/** Serializable body for {@link ICreateAppRequest}. */
export class CreateAppRequest implements ICreateAppRequest {
  appName: string = "";
  description?: string;
  workspaceConnectionId: number = 0;
  databricksAppMode: DatabricksAppCreationMode =
    DatabricksAppCreationMode.LinkExisting;
  databricksAppName?: string;
  databricksAppDescription?: string;
  databricksAppResources?: DatabricksAppResource[];
  workspacePath?: string;
  workflowDefinition?: string;

  constructor(init?: Partial<ICreateAppRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
