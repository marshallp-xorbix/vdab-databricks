import type { IPaymentMethod } from "./PaymentMethod";
import { PaymentMethod } from "./PaymentMethod";
import type { ISeatSummary } from "./SeatSummary";
import { SeatSummary } from "./SeatSummary";
import type { ISubscription } from "./Subscription";
import { Subscription } from "./Subscription";

export interface IBillingStatus {
  hasSubscription: boolean;
  subscription?: ISubscription;
  seatSummary?: ISeatSummary;
  paymentMethods: IPaymentMethod[];
  defaultPaymentMethodId?: string;
}

export class BillingStatus implements IBillingStatus {
  hasSubscription: boolean = false;
  subscription?: Subscription;
  seatSummary?: SeatSummary;
  paymentMethods: PaymentMethod[] = [];
  defaultPaymentMethodId?: string;

  constructor(init?: Partial<IBillingStatus>) {
    if (init) {
      Object.assign(this, init);

      if (init.subscription) {
        this.subscription = new Subscription(init.subscription);
      }
      if (init.seatSummary) {
        this.seatSummary = new SeatSummary(init.seatSummary);
      }
      if (init.paymentMethods) {
        this.paymentMethods = init.paymentMethods.map(
          (paymentMethod) => new PaymentMethod(paymentMethod),
        );
      }
    }
  }
}
