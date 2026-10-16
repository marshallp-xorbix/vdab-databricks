export interface IUpdateAppRequest {
  appName: string;
  databricksAppName?: string;
  description?: string;
  workspaceConnectionId: number;
  workspacePath?: string;
  version: number;
  lastPublishedAt?: string;
  theme?: string;
  workflowDefinition?: string;
  customModulesCode?: string;
}

export class UpdateAppRequest implements IUpdateAppRequest {
  appName: string = "";
  databricksAppName?: string;
  description?: string;
  workspaceConnectionId: number = 0;
  workspacePath?: string;
  version: number = 0;
  lastPublishedAt?: string;
  theme?: string;
  workflowDefinition?: string;
  customModulesCode?: string;

  constructor(init?: Partial<IUpdateAppRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
