export interface IUpdateDatabricksConnectionRequest {
  workspaceUrl: string;
  workspaceDisplayName: string;
  clientId?: string;
  clientSecret?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;
}

export class UpdateDatabricksConnectionRequest
  implements IUpdateDatabricksConnectionRequest
{
  workspaceUrl: string = "";
  workspaceDisplayName: string = "";
  clientId?: string;
  clientSecret?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;

  constructor(init?: Partial<IUpdateDatabricksConnectionRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
