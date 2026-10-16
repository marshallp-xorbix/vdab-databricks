/**
 * Trial terms for a subscription plan. Mirrors the backend `PlanTrialDto`.
 * Limits are flat totals (they do not scale per seat); `0` indicates unlimited.
 */
export interface IPlanTrial {
  periodDays: number;
  seats: number;
  maxPublishedApps: number;
  maxWorkspaceConnections: number;
}

/**
 * A subscription plan from the backend plans catalog (`GET /api/Billing/plans`).
 * Mirrors the backend `PlanDto`. Display prices are in cents; for per-seat plans the price
 * and limits are per seat. A limit of `0` indicates unlimited.
 */
export interface IPlan {
  tier: string;
  slug: string;
  displayName: string;
  perSeat: boolean;
  minimumSeats: number;
  selfServiceCheckout: boolean;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxPublishedApps: number;
  maxWorkspaceConnections: number;
  trial?: IPlanTrial;
}

/**
 * Data class for a subscription plan. Holds catalog/pricing data only — no behavior.
 */
export class Plan implements IPlan {
  tier: string = "";
  slug: string = "";
  displayName: string = "";
  perSeat: boolean = false;
  minimumSeats: number = 0;
  selfServiceCheckout: boolean = false;
  monthlyPriceCents: number = 0;
  yearlyPriceCents: number = 0;
  maxPublishedApps: number = 0;
  maxWorkspaceConnections: number = 0;
  trial?: IPlanTrial;

  constructor(init?: Partial<IPlan>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
