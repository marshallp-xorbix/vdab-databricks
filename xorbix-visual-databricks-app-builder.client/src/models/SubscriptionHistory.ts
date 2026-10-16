import { parseApiDate } from "../lib/utils";

/**
 * Wire shape of a single subscription history record returned by
 * `GET /api/Tenant/{id}/subscription-history`.
 */
export interface ISubscriptionHistory {
  subscriptionHistoryId: number;
  tenantId: string;
  eventType: string;
  subscriptionTier: string;
  billingCycle: string;
  amount?: number | null;
  currency: string;
  externalTransactionId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  paymentStatus?: string | null;
  stripeEventId?: string | null;
  notes?: string | null;
  eventDate: string | Date;
}

/**
 * Class wrapper that parses `eventDate` into a Date on construction.
 */
export class SubscriptionHistory implements ISubscriptionHistory {
  subscriptionHistoryId: number = 0;
  tenantId: string = "";
  eventType: string = "";
  subscriptionTier: string = "";
  billingCycle: string = "Monthly";
  amount?: number | null;
  currency: string = "USD";
  externalTransactionId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  paymentStatus?: string | null;
  stripeEventId?: string | null;
  notes?: string | null;
  eventDate: Date = new Date();

  constructor(init?: Partial<ISubscriptionHistory>) {
    if (init) {
      Object.assign(this, init);
      if (init.eventDate) {
        this.eventDate = parseApiDate(init.eventDate);
      }
    }
  }
}

