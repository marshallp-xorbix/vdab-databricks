import { parseApiDate } from "../lib/utils";

export interface IRemovedTenantMember {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  removedOn: string | Date;
  removedBy?: string;
}

export class RemovedTenantMember implements IRemovedTenantMember {
  userId: string = "";
  email: string = "";
  firstName?: string;
  lastName?: string;
  role: string = "";
  removedOn: Date = new Date();
  removedBy?: string;

  constructor(init?: Partial<IRemovedTenantMember>) {
    if (init) {
      Object.assign(this, init);
      if (init.removedOn) this.removedOn = parseApiDate(init.removedOn);
    }
  }

  get displayName(): string {
    const name = `${this.firstName ?? ""} ${this.lastName ?? ""}`.trim();
    return name || this.email;
  }
}
