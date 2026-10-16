import { parseApiDate } from "../lib/utils";
import type { IPaymentMethod } from "./PaymentMethod";
import { PaymentMethod } from "./PaymentMethod";
import type { ISeatSummary } from "./SeatSummary";
import { SeatSummary } from "./SeatSummary";

import type { ISubscriptionDiscount } from "./SubscriptionDiscount";
import { SubscriptionDiscount } from "./SubscriptionDiscount";

export interface ISubscription {
  id: string;
  tier: string;
  /**
   * Current billing interval as reported by the API — the backend
   * `BillingInterval` name ("Monthly" or "Yearly"). Treated as an opaque token
   * that is echoed back on a plan (tier) change so the billing cadence is
   * preserved instead of being reset to monthly. Distinct from the pricing-UI
   * `BillingInterval` union ("monthly" | "annual").
   */
  billingInterval?: string;
  status: string;
  currentPeriodStart: string | Date;
  currentPeriodEnd: string | Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | Date;
  defaultPaymentMethod?: IPaymentMethod;
  seatSummary?: ISeatSummary;
  totalSeats: number;
  clientSecret?: string;
  /**
   * Whether the tenant has a Stripe customer backing this plan. `false` for
   * manually provisioned plans (e.g. an administrator tier override) that have
   * no Stripe billing account. Gates billing and invoice features in the UI.
   */
  hasStripeCustomer: boolean;
  /**
   * Whether the tenant may use Seats & Users and invites with complimentary
   * (non-Stripe) seat capacity. True for configured internal/dev tenants.
   */
  allowsComplimentarySeatManagement: boolean;
  discount?: ISubscriptionDiscount;
}

export class Subscription implements ISubscription {
  id: string = "";
  tier: string = "";
  billingInterval?: string;
  status: string = "";
  currentPeriodStart: Date = new Date();
  currentPeriodEnd: Date = new Date();
  cancelAtPeriodEnd: boolean = false;
  canceledAt?: Date;
  defaultPaymentMethod?: PaymentMethod;
  seatSummary?: SeatSummary;
  totalSeats: number = 0;
  clientSecret?: string;
  hasStripeCustomer: boolean = true;
  allowsComplimentarySeatManagement: boolean = false;
  discount?: SubscriptionDiscount;

  constructor(init?: Partial<ISubscription>) {
    if (init) {
      Object.assign(this, init);

      if (init.currentPeriodStart) {
        this.currentPeriodStart = parseApiDate(init.currentPeriodStart);
      }
      if (init.currentPeriodEnd) {
        this.currentPeriodEnd = parseApiDate(init.currentPeriodEnd);
      }
      if (init.canceledAt) {
        this.canceledAt = parseApiDate(init.canceledAt);
      }
      if (init.defaultPaymentMethod) {
        this.defaultPaymentMethod = new PaymentMethod(
          init.defaultPaymentMethod,
        );
      }
      if (init.seatSummary) {
        this.seatSummary = new SeatSummary(init.seatSummary);
      }
      if (init.discount) {
        this.discount = new SubscriptionDiscount(init.discount);
      }
    }
  }
}
