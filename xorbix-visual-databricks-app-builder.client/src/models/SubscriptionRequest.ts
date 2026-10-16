export interface ISubscriptionRequest {
  tier: string;
  billingInterval: string;
  startTrial?: boolean;
  promoCode?: string;
}

export class SubscriptionRequest implements ISubscriptionRequest {
  tier: string = "";
  billingInterval: string = "monthly";
  startTrial?: boolean;
  promoCode?: string;

  constructor(init?: Partial<ISubscriptionRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
