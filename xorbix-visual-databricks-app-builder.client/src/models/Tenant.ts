import type { IApplicationUser } from "./ApplicationUser";
import type { IDatabricksConnection } from "./DatabricksConnection";
import type { ISubscriptionHistory } from "./SubscriptionHistory";
import { parseApiDate } from "../lib/utils";

export interface ITenant {
  tenantId: string;
  tenantName: string;
  displayName: string;
  isActive: boolean;
  subscriptionTier: string;
  billingCycle: string;
  maxUsers: number;
  maxPublishedApps: number;
  maxWorkspaceConnections: number;
  subscriptionStartDate?: string | Date;
  subscriptionEndDate?: string | Date;
  trialEndDate?: string | Date;
  autoRenew: boolean;
  billingCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionStatus?: string;
  ownerId?: string;
  invoiceName?: string;
  invoiceEmail?: string;

  // TrackableEntity properties
  createdOn: string | Date;
  createdBy?: number;
  modifiedOn?: string | Date;
  modifiedBy?: number;

  // Tenant usage snapshot values used by management grids.
  userCount?: number;
  appCount?: number;

  users?: IApplicationUser[];
  databricksConnections?: IDatabricksConnection[];
  subscriptionHistory?: ISubscriptionHistory[];
}

export class Tenant implements ITenant {
  tenantId: string = "";
  tenantName: string = "";
  displayName: string = "";
  isActive: boolean = true;
  subscriptionTier: string = "Free";
  billingCycle: string = "Monthly";
  maxUsers: number = 5;
  maxPublishedApps: number = 10;
  maxWorkspaceConnections: number = 3;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  trialEndDate?: Date;
  autoRenew: boolean = true;
  billingCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionStatus: string = "incomplete";
  ownerId?: string;
  invoiceName?: string;
  invoiceEmail?: string;

  createdOn: Date = new Date();
  createdBy?: number;
  modifiedOn?: Date;
  modifiedBy?: number;

  userCount?: number;
  appCount?: number;

  users: IApplicationUser[] = [];
  databricksConnections: IDatabricksConnection[] = [];
  subscriptionHistory: ISubscriptionHistory[] = [];

  constructor(init?: Partial<ITenant>) {
    if (init) {
      Object.assign(this, init);

      if (init.subscriptionStartDate)
        this.subscriptionStartDate = parseApiDate(init.subscriptionStartDate);
      if (init.subscriptionEndDate)
        this.subscriptionEndDate = parseApiDate(init.subscriptionEndDate);
      if (init.trialEndDate)
        this.trialEndDate = parseApiDate(init.trialEndDate);
      if (init.createdOn) this.createdOn = parseApiDate(init.createdOn);
      if (init.modifiedOn) this.modifiedOn = parseApiDate(init.modifiedOn);
    }
  }
}
