export interface ICreateDatabricksConnectionRequest {
  workspaceUrl: string;
  workspaceDisplayName: string;
  clientId?: string;
  clientSecret?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;
}

export class CreateDatabricksConnectionRequest
  implements ICreateDatabricksConnectionRequest
{
  workspaceUrl: string = "";
  workspaceDisplayName: string = "";
  clientId?: string;
  clientSecret?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;

  constructor(init?: Partial<ICreateDatabricksConnectionRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
