import { parseApiDate } from "../lib/utils";

export interface ITenantInvite {
  id: string;
  tenantId: string;
  email: string;
  status: string;
  tokenExpiresAt: string | Date;
  invitedAt: string | Date;
  invitedByUserId: string;
  requiresSeatPurchase: boolean;
  acceptedAt?: string | Date;
}

export class TenantInvite implements ITenantInvite {
  id: string = "";
  tenantId: string = "";
  email: string = "";
  status: string = "";
  tokenExpiresAt: Date = new Date();
  invitedAt: Date = new Date();
  invitedByUserId: string = "";
  requiresSeatPurchase: boolean = false;
  acceptedAt?: Date;

  constructor(init?: Partial<ITenantInvite>) {
    if (init) {
      Object.assign(this, init);

      if (init.tokenExpiresAt) {
        this.tokenExpiresAt = parseApiDate(init.tokenExpiresAt);
      }
      if (init.invitedAt) {
        this.invitedAt = parseApiDate(init.invitedAt);
      }
      if (init.acceptedAt) {
        this.acceptedAt = parseApiDate(init.acceptedAt);
      }
    }
  }
}
