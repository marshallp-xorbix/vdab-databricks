import type { WorkflowDefinition } from "../types/workflow";

export interface IDeployAppRequest {
  AppId: number;
  Description: string;
  FormComponents: Record<string, unknown>[];
  WorkflowDefinition?: WorkflowDefinition;
  DatabricksAppName: string;
  TargetPath: string;
}

export class DeployAppRequest implements IDeployAppRequest {
  AppId: number = 0;
  Description: string = "";
  FormComponents: Record<string, unknown>[] = [];
  WorkflowDefinition?: WorkflowDefinition;
  DatabricksAppName: string = "";
  TargetPath: string = "";

  constructor(init?: Partial<IDeployAppRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export interface IDeployAppResponse {
  appUrl?: string;
}

export class DeployAppResponse implements IDeployAppResponse {
  appUrl?: string;

  constructor(init?: Partial<IDeployAppResponse>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
