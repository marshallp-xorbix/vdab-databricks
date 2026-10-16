export interface IValidatePromoCodeRequest {
  code: string;
  tier: string;
  billingInterval: string;
}

export interface IPromoCodeValidation {
  isValid: boolean;
  message: string;
  freeMonths: number;
  discountEndsAt?: string | Date;
}

export class PromoCodeValidation implements IPromoCodeValidation {
  isValid: boolean = false;
  message: string = "";
  freeMonths: number = 0;
  discountEndsAt?: Date;

  constructor(init?: Partial<IPromoCodeValidation>) {
    if (init) {
      Object.assign(this, init);
      if (init.discountEndsAt) {
        this.discountEndsAt = new Date(init.discountEndsAt);
      }
    }
  }
}
