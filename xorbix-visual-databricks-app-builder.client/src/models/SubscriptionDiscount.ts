export interface ISubscriptionDiscount {
  promoCode?: string;
  freeMonths: number;
  discountEndsAt?: string | Date;
  percentOff: number;
}

export class SubscriptionDiscount implements ISubscriptionDiscount {
  promoCode?: string;
  freeMonths: number = 0;
  discountEndsAt?: Date;
  percentOff: number = 0;

  constructor(init?: Partial<ISubscriptionDiscount>) {
    if (init) {
      Object.assign(this, init);
      if (init.discountEndsAt) {
        this.discountEndsAt = new Date(init.discountEndsAt);
      }
    }
  }
}
