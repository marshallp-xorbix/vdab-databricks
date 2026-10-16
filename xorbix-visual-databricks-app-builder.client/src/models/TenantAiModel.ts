export interface ITenantAiModel {
  tenantAiModelId: number;
  tenantId: string;
  databricksConnectionId: number;
  displayName: string;
  endpointName: string;
  databricksConnectionDisplayName: string;
  workspaceUrl: string;
  hasAccessToken: boolean;
  createdOn: string;
  createdByUserId: string;
}

export interface ICreateTenantAiModelRequest {
  displayName: string;
  databricksConnectionId: number;
  endpointName: string;
  accessToken: string;
}

export interface IUpdateTenantAiModelRequest {
  displayName: string;
  databricksConnectionId: number;
  endpointName: string;
  accessToken?: string;
}

export class CreateTenantAiModelRequest implements ICreateTenantAiModelRequest {
  displayName = "";
  databricksConnectionId = 0;
  endpointName = "";
  accessToken = "";

  constructor(init?: Partial<ICreateTenantAiModelRequest>) {
    if (init) Object.assign(this, init);
  }
}

export class UpdateTenantAiModelRequest implements IUpdateTenantAiModelRequest {
  displayName = "";
  databricksConnectionId = 0;
  endpointName = "";
  accessToken?: string;

  constructor(init?: Partial<IUpdateTenantAiModelRequest>) {
    if (init) Object.assign(this, init);
  }
}
