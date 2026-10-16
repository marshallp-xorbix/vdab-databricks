import type { ITenant } from "./Tenant";
import type { IApplicationUser } from "./ApplicationUser";
import { parseApiDate } from "../lib/utils";

export interface IDatabricksConnection {
  pkId: number;
  tenantId?: string;
  ownerId: string;
  workspaceUrl: string;
  workspaceDisplayName: string;
  clientId?: string;
  clientSecret?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;
  tenant?: ITenant;
  user?: IApplicationUser;

  // TrackableEntity properties
  createdOn: string | Date;
  createdBy?: string;
  modifiedOn?: string | Date;
  modifiedBy?: string;
}

export class DatabricksConnection implements IDatabricksConnection {
  pkId: number = 0;
  tenantId?: string;
  ownerId: string = "";
  workspaceUrl: string = "";
  workspaceDisplayName: string = "";
  clientId?: string;
  clientSecret?: string;
  accessTokenTtlMinutes?: number;
  refreshTokenLifespanMinutes?: number;
  tenant?: ITenant;
  user?: IApplicationUser;

  createdOn: Date = new Date();
  createdBy?: string;
  modifiedOn?: Date;
  modifiedBy?: string;

  constructor(init?: Partial<IDatabricksConnection>) {
    if (init) {
      Object.assign(this, init);
      if (init.createdOn) this.createdOn = parseApiDate(init.createdOn);
      if (init.modifiedOn) this.modifiedOn = parseApiDate(init.modifiedOn);
    }
  }
}
