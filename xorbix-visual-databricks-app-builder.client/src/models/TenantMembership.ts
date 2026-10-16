export interface ITenantMembership {
  tenantId: string;
  tenantName: string;
  displayName: string;
  role: string;
  isDefault: boolean;
  isCurrentTenant: boolean;
}

export class TenantMembership implements ITenantMembership {
  tenantId: string = "";
  tenantName: string = "";
  displayName: string = "";
  role: string = "";
  isDefault: boolean = false;
  isCurrentTenant: boolean = false;

  constructor(init?: Partial<ITenantMembership>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}