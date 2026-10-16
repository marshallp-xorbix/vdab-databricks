/**
 * Billing interval shown in the pricing UI. The backend uses "Monthly"/"Yearly";
 * the client uses "monthly"/"annual".
 */
export type BillingInterval = "monthly" | "annual";

/** A feature-comparison cell: a checkmark (boolean) or free text. */
export type FeatureValue = boolean | string;

/**
 * Presentation model for a pricing plan card. Pricing, limits, and trial terms come from the
 * backend plans endpoint; descriptive marketing copy is layered on in the client. Prices are
 * pre-formatted display strings (for example "$20").
 */
export interface Tier {
  name: string;
  slug: string;
  monthlyPrice: string;
  monthlyPriceNote: string;
  annualPrice: string;
  annualPriceNote: string;
  annualBillingNote: string;
  description: string;
  cta: string;
  ctaLink: string;
  highlighted: boolean;
  badge: string | null;
  highlights: string[];
  /** False for sales-assisted plans (Enterprise); drives the "contact sales" affordance. */
  selfServiceCheckout: boolean;
  /** Trial length in days, or null when the plan offers no trial. */
  trialDays: number | null;
}

/** A row in the plan comparison table. Cell values are keyed by tier slug. */
export interface ComparisonRow {
  feature: string;
  values: Record<string, FeatureValue>;
}

/** A pricing FAQ entry. */
export interface Faq {
  q: string;
  a: string;
}
