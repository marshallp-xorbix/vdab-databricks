import type { Plan } from "../models";
import { SubscriptionTierSlug } from "../types/subscriptionTier";
import type {
  BillingInterval,
  ComparisonRow,
  Faq,
  FeatureValue,
  Tier,
} from "../types/pricing";

/**
 * Pure pricing helpers and the marketing copy layered onto the backend plan catalog.
 *
 * The backend plans endpoint owns the source-of-truth numbers (prices, limits, seats, trial
 * terms). This module turns a {@link Plan} into the presentation {@link Tier} the UI renders,
 * generating all number-bearing copy from the plan so it cannot drift from the backend.
 */

const SIGNUP_LINK = "/signup";
const COMING_SOON_LINK = "";

/** Marketing copy layered onto the backend plan data, keyed by tier slug. */
interface TierContent {
  description: string;
  badge: string | null;
  highlighted: boolean;
  /** Non-numeric feature bullets. Numeric limit lines are generated from the plan. */
  features: string[];
}

const TIER_CONTENT: Record<string, TierContent> = {
  [SubscriptionTierSlug.Individual]: {
    description:
      "Perfect for solo developers and data engineers building production apps with VDAB.",
    badge: null,
    highlighted: false,
    features: [
      "Visual app builder",
      "Component library",
      "Community support",
      "10 AI Builder credits per month",
    ],
  },
  [SubscriptionTierSlug.Team]: {
    description:
      "For data teams that need collaboration and workspace flexibility.",
    badge: "Most Popular",
    highlighted: true,
    features: [
      "Everything in Individual",
      "Component library",
      "10 AI Builder credits per month per seat",
      "Team collaboration & seat management",
      "Priority support",
    ],
  },
  [SubscriptionTierSlug.Enterprise]: {
    description:
      "For large organizations needing unlimited scale, SSO, and a dedicated support team.",
    badge: null,
    highlighted: false,
    features: [
      "Everything in Team",
      "SSO & enterprise security",
      "Dedicated support priority",
    ],
  },
};

const EMPTY_CONTENT: TierContent = {
  description: "",
  badge: null,
  highlighted: false,
  features: [],
};

/**
 * Ranks the self-service tiers (lowest to highest). Enterprise is intentionally excluded —
 * it is contact-sales only and cannot be selected through the in-app upgrade flow.
 */
export const TIER_RANK: Record<string, number> = {
  [SubscriptionTierSlug.Individual]: 1,
  [SubscriptionTierSlug.Team]: 2,
};

/** Formats a price in cents as a USD display string, e.g. 2000 -> "$20", 2500000 -> "$25,000". */
export function formatPriceCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Builds a highlight bullet for a limit; `0` renders as "Unlimited". */
function describeLimit(
  value: number,
  singular: string,
  plural: string,
  perSeat: boolean,
): string {
  if (value === 0) {
    return `Unlimited ${plural}`;
  }
  const unit = value === 1 ? singular : plural;
  return perSeat ? `${value} ${unit} per seat` : `${value} ${unit}`;
}

/** Renders a limit as a comparison-table cell; `0` becomes "Unlimited". */
function limitCell(value: number, perSeat: boolean): FeatureValue {
  if (value === 0) {
    return "Unlimited";
  }
  return perSeat ? `${value} / seat` : `${value}`;
}

/** Maps a backend plan to the presentation tier rendered by the pricing UI. */
export function mapPlanToTier(plan: Plan): Tier {
  const content = TIER_CONTENT[plan.slug] ?? EMPTY_CONTENT;

  const highlights: string[] = [
    describeLimit(
      plan.maxPublishedApps,
      "published app",
      "published apps",
      plan.perSeat,
    ),
    describeLimit(
      plan.maxWorkspaceConnections,
      "workspace connection",
      "workspace connections",
      plan.perSeat,
    ),
    ...content.features,
  ];
  if (plan.perSeat && plan.minimumSeats > 0) {
    highlights.unshift(`Minimum ${plan.minimumSeats} seats`);
  }

  const monthlyNote = plan.perSeat ? "/ seat / month" : "/ month";
  const yearlyNote = plan.perSeat ? "/ seat / year" : "/ year";

  // Plans without a monthly price (annual-only Enterprise) show their yearly price in both views.
  let monthlyPrice: string;
  let monthlyPriceNote: string;
  if (plan.monthlyPriceCents > 0) {
    monthlyPrice = formatPriceCents(plan.monthlyPriceCents);
    monthlyPriceNote = monthlyNote;
  } else if (plan.yearlyPriceCents > 0) {
    monthlyPrice = formatPriceCents(plan.yearlyPriceCents);
    monthlyPriceNote = yearlyNote;
  } else {
    monthlyPrice = "Custom";
    monthlyPriceNote = "";
  }

  let annualPrice: string;
  let annualPriceNote: string;
  let annualBillingNote: string;
  if (plan.yearlyPriceCents > 0) {
    annualPrice = formatPriceCents(plan.yearlyPriceCents);
    annualPriceNote = yearlyNote;
    // "billed annually" only adds clarity when there is also a monthly price to contrast with.
    annualBillingNote = plan.monthlyPriceCents > 0 ? "billed annually" : "";
  } else {
    annualPrice = "Custom";
    annualPriceNote = "";
    annualBillingNote = "";
  }

  return {
    name: plan.displayName,
    slug: plan.slug,
    monthlyPrice,
    monthlyPriceNote,
    annualPrice,
    annualPriceNote,
    annualBillingNote,
    description: content.description,
    cta: plan.selfServiceCheckout ? "Get Started" : "Coming 2027",
    ctaLink: plan.selfServiceCheckout ? SIGNUP_LINK : COMING_SOON_LINK,
    highlighted: content.highlighted,
    badge: content.badge,
    highlights,
    selfServiceCheckout: plan.selfServiceCheckout,
    trialDays: plan.trial?.periodDays ?? null,
  };
}

/** Maps the backend plan catalog to presentation tiers. */
export function mapPlansToTiers(plans: Plan[]): Tier[] {
  return plans.map(mapPlanToTier);
}

/** Static (non-pricing) feature rows shown above the generated limit rows. */
const COMPARISON_TOP: ComparisonRow[] = [
  {
    feature: "Visual app builder",
    values: {
      [SubscriptionTierSlug.Individual]: true,
      [SubscriptionTierSlug.Team]: true,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
];

/** Static (non-pricing) feature rows shown below the generated limit rows. */
const COMPARISON_BOTTOM: ComparisonRow[] = [
  {
    feature: "Advanced components",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: true,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
  {
    feature: "Team collaboration & seat management",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: true,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
  {
    feature: "Role-based access control",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: true,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
  {
    feature: "Priority support",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: true,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
  {
    feature: "SSO & enterprise security",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: false,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
  {
    feature: "Custom SLA & contracts",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: false,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
  {
    feature: "Dedicated support",
    values: {
      [SubscriptionTierSlug.Individual]: false,
      [SubscriptionTierSlug.Team]: false,
      [SubscriptionTierSlug.Enterprise]: true,
    },
  },
];

/** Builds the feature-comparison rows, deriving the numeric/limit rows from the plan catalog. */
export function buildComparison(plans: Plan[]): ComparisonRow[] {
  const fromPlans = (
    cell: (plan: Plan) => FeatureValue,
  ): Record<string, FeatureValue> =>
    Object.fromEntries(plans.map((plan) => [plan.slug, cell(plan)]));

  const limitRows: ComparisonRow[] = [
    {
      feature: "Published apps",
      values: fromPlans((plan) =>
        limitCell(plan.maxPublishedApps, plan.perSeat),
      ),
    },
    {
      feature: "Workspace connections",
      values: fromPlans((plan) =>
        limitCell(plan.maxWorkspaceConnections, plan.perSeat),
      ),
    },
    {
      feature: "Free trial",
      values: fromPlans((plan) =>
        plan.trial ? `${plan.trial.periodDays} days` : false,
      ),
    },
  ];

  return [...COMPARISON_TOP, ...limitRows, ...COMPARISON_BOTTOM];
}

/** Builds the pricing FAQs, filling seat-minimum and trial-length copy from the plan catalog. */
export function buildFaqs(plans: Plan[]): Faq[] {
  const teamPlan = plans.find(
    (plan) => plan.slug === SubscriptionTierSlug.Team,
  );
  const trialPlan = plans.find((plan) => plan.trial != null);
  const teamMinSeats = teamPlan?.minimumSeats ?? 3;
  const trialDays = trialPlan?.trial?.periodDays ?? 14;

  return [
    {
      q: "Can I switch plans later?",
      a: "Yes. You can upgrade at any time. Your apps and connections carry over automatically.",
    },
    {
      q: "What counts as a published app?",
      a: "A published app is any app you deploy to a Databricks workspace. Draft apps on the canvas don't count toward your limit.",
    },
    {
      q: "Is there a free trial?",
      a: `Yes — the Individual and Team plans include a ${trialDays}-day free trial. A credit card is required up front, and you won't be charged until the trial ends. Cancel any time before then to avoid charges.`,
    },
    {
      q: "How does seat billing work for the Team plan?",
      a: `You purchase a minimum of ${teamMinSeats} seats. Additional seats can be added at any time and are billed pro-rata for the remainder of the billing period. Your workspace and app limits scale with the number of seats.`,
    },
    {
      q: "How is annual billing discounted?",
      a: "Annual billing costs less than paying monthly for twelve months. You're billed once per year for the full amount.",
    },
  ];
}

/** Finds a presentation tier by slug. Comparison is case- and whitespace-insensitive. */
export function getTierBySlug(
  tiers: Tier[],
  slug: string | null | undefined,
): Tier | undefined {
  if (!slug) {
    return undefined;
  }
  const normalized = slug.trim().toLowerCase();
  return tiers.find((tier) => tier.slug === normalized);
}

/**
 * Returns the tiers a user on `currentSlug` can upgrade to. Pass `null`/`undefined`/`""` to get
 * all self-service tiers. Comparison is case- and whitespace-insensitive; Enterprise is excluded.
 */
export function getUpgradeTiers(
  tiers: Tier[],
  currentSlug: string | null | undefined,
): Tier[] {
  const normalized = (currentSlug ?? "").trim().toLowerCase();
  const currentRank = normalized === "" ? -1 : (TIER_RANK[normalized] ?? -1);
  return tiers.filter(
    (tier) => tier.slug in TIER_RANK && TIER_RANK[tier.slug] > currentRank,
  );
}

/**
 * Returns the tiers a user on `currentSlug` can downgrade to. Returns an empty
 * list when there is no current plan or the current tier has no lower self-service
 * option. Comparison is case- and whitespace-insensitive; Enterprise is excluded.
 */
export function getDowngradeTiers(
  tiers: Tier[],
  currentSlug: string | null | undefined,
): Tier[] {
  const normalized = (currentSlug ?? "").trim().toLowerCase();
  if (normalized === "") {
    return [];
  }
  const currentRank = TIER_RANK[normalized] ?? -1;
  if (currentRank < 0) {
    return [];
  }
  return tiers.filter(
    (tier) => tier.slug in TIER_RANK && TIER_RANK[tier.slug] < currentRank,
  );
}

/** Formats a tier's price for the given interval, e.g. "$20 / month" or "$160 / seat / year". */
export function formatPlanPriceLabel(
  tier: Tier,
  interval: BillingInterval,
): string {
  return interval === "annual"
    ? `${tier.annualPrice} ${tier.annualPriceNote}`.trim()
    : `${tier.monthlyPrice} ${tier.monthlyPriceNote}`.trim();
}

/** Builds the checkout trial-disclosure copy ("Free for N days, then $X, billed on <date>…"). */
export function buildTrialMessage(
  trialDays: number,
  priceLabel: string,
  billedOnLabel: string,
): string {
  return `Free for ${trialDays} days, then ${priceLabel}. A payment method is required now, and you'll be billed on ${billedOnLabel} unless you cancel before then.`;
}
