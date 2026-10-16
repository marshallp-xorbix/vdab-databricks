export interface IDatabricksConnectionStatusDto {
  pkId: number;
  workspaceDisplayName: string;
  workspaceUrl: string;
  clientId?: string;
  isAuthorized: boolean;
  tokenExpiresAt?: string | Date;
}

export class DatabricksConnectionStatusDto implements IDatabricksConnectionStatusDto {
  pkId: number = 0;
  workspaceDisplayName: string = "";
  workspaceUrl: string = "";
  clientId?: string;
  isAuthorized: boolean = false;
  tokenExpiresAt?: Date;

  constructor(init?: Partial<IDatabricksConnectionStatusDto>) {
    if (init) {
      Object.assign(this, init);
      if (init.tokenExpiresAt)
        this.tokenExpiresAt = new Date(init.tokenExpiresAt as string);
    }
  }
}
