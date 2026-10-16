export interface ICreateTenantRequest {
  tenantName: string;
  displayName: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  ownerId?: string;
  billingName?: string;
  email?: string;
}

export class CreateTenantRequest implements ICreateTenantRequest {
  tenantName: string = "";
  displayName: string = "";
  subscriptionTier?: string;
  subscriptionStatus?: string;
  ownerId?: string;
  billingName?: string;
  email?: string;

  constructor(init?: Partial<ICreateTenantRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
