export interface IUpdateWorkspaceRefreshTokenRequest {
  workspaceConnectionId: number;
  refreshToken: string;
  expiresAt?: Date | string;
}

export class UpdateWorkspaceRefreshTokenRequest implements IUpdateWorkspaceRefreshTokenRequest {
  workspaceConnectionId: number = 0;
  refreshToken: string = "";
  expiresAt?: Date;

  constructor(init?: Partial<IUpdateWorkspaceRefreshTokenRequest>) {
    if (init) {
      Object.assign(this, init);
      if (init.expiresAt && typeof init.expiresAt === "string") {
        this.expiresAt = new Date(init.expiresAt);
      }
    }
  }
}
