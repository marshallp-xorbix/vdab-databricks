import { parseApiDate } from "../lib/utils";

export interface IAppDto {
  id: number;
  ownerId: string;
  ownerEmail?: string;
  appName: string;
  databricksAppName?: string;
  description?: string;
  tenantId?: string;
  workspaceConnectionId: number;
  workspacePath?: string;
  version: number;
  lastPublishedAt?: string;
  createdOn: string | Date;
  createdBy?: string;
  modifiedOn?: string | Date;
  modifiedBy?: string;
  deletedOn?: string | Date;
  deletedBy?: string;
  theme?: string;
  workflowDefinition?: string;
  /** Persisted Streamlit helper module (`custom_modules.py`). */
  customModulesCode?: string;
}

export class AppDto implements IAppDto {
  id: number = 0;
  ownerId: string = "";
  ownerEmail?: string;
  appName: string = "";
  databricksAppName?: string;
  description?: string;
  tenantId?: string;
  workspaceConnectionId: number = 0;
  workspacePath?: string;
  version: number = 0;
  lastPublishedAt?: string;
  createdOn: Date = new Date();
  createdBy?: string;
  modifiedOn?: Date;
  modifiedBy?: string;
  deletedOn?: Date;
  deletedBy?: string;
  theme?: string;
  workflowDefinition?: string;
  customModulesCode?: string;

  constructor(init?: Partial<IAppDto>) {
    if (init) {
      Object.assign(this, init);
      if (init.createdOn) this.createdOn = parseApiDate(init.createdOn);
      if (init.modifiedOn) this.modifiedOn = parseApiDate(init.modifiedOn);
      if (init.deletedOn) this.deletedOn = parseApiDate(init.deletedOn);
    }
  }
}
