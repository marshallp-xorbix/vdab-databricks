import { describe, expect, it } from "vitest";
import { Plan } from "../../models";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import {
  buildComparison,
  buildFaqs,
  buildTrialMessage,
  formatPlanPriceLabel,
  formatPriceCents,
  getDowngradeTiers,
  getTierBySlug,
  getUpgradeTiers,
  mapPlanToTier,
  mapPlansToTiers,
} from "../pricing";

function individualPlan(): Plan {
  return new Plan({
    tier: "Individual",
    slug: SubscriptionTierSlug.Individual,
    displayName: "Individual",
    perSeat: false,
    minimumSeats: 1,
    selfServiceCheckout: true,
    monthlyPriceCents: 2000,
    yearlyPriceCents: 22000,
    maxPublishedApps: 10,
    maxWorkspaceConnections: 2,
    trial: {
      periodDays: 14,
      seats: 1,
      maxPublishedApps: 1,
      maxWorkspaceConnections: 1,
    },
  });
}

function teamPlan(): Plan {
  return new Plan({
    tier: "Team",
    slug: SubscriptionTierSlug.Team,
    displayName: "Team",
    perSeat: true,
    minimumSeats: 3,
    selfServiceCheckout: true,
    monthlyPriceCents: 1500,
    yearlyPriceCents: 16000,
    maxPublishedApps: 20,
    maxWorkspaceConnections: 3,
    trial: {
      periodDays: 14,
      seats: 3,
      maxPublishedApps: 3,
      maxWorkspaceConnections: 3,
    },
  });
}

function enterprisePlan(): Plan {
  return new Plan({
    tier: "Enterprise",
    slug: SubscriptionTierSlug.Enterprise,
    displayName: "Enterprise",
    perSeat: false,
    minimumSeats: 0,
    selfServiceCheckout: false,
    monthlyPriceCents: 0,
    yearlyPriceCents: 2500000,
    maxPublishedApps: 0,
    maxWorkspaceConnections: 0,
  });
}

function allPlans(): Plan[] {
  return [individualPlan(), teamPlan(), enterprisePlan()];
}

describe("formatPriceCents", () => {
  it("formats whole-dollar amounts without decimals", () => {
    expect(formatPriceCents(2000)).toBe("$20");
    expect(formatPriceCents(22000)).toBe("$220");
    expect(formatPriceCents(1500)).toBe("$15");
  });

  it("adds thousands separators for large amounts", () => {
    expect(formatPriceCents(2500000)).toBe("$25,000");
  });
});

describe("mapPlanToTier", () => {
  it("maps a flat self-service plan (Individual) with monthly/annual pricing", () => {
    const tier = mapPlanToTier(individualPlan());

    expect(tier.slug).toBe(SubscriptionTierSlug.Individual);
    expect(tier.monthlyPrice).toBe("$20");
    expect(tier.monthlyPriceNote).toBe("/ month");
    expect(tier.annualPrice).toBe("$220");
    expect(tier.annualPriceNote).toBe("/ year");
    expect(tier.annualBillingNote).toBe("billed annually");
    expect(tier.selfServiceCheckout).toBe(true);
    expect(tier.cta).toBe("Get Started");
    expect(tier.ctaLink).toBe("/signup");
    expect(tier.trialDays).toBe(14);
    expect(tier.highlights).toContain("10 published apps");
    expect(tier.highlights).toContain("2 workspace connections");
    expect(tier.highlights.some((h) => h.startsWith("Minimum"))).toBe(false);
  });

  it("maps a per-seat plan (Team) with per-seat notes and a minimum-seats highlight", () => {
    const tier = mapPlanToTier(teamPlan());

    expect(tier.monthlyPrice).toBe("$15");
    expect(tier.monthlyPriceNote).toBe("/ seat / month");
    expect(tier.annualPrice).toBe("$160");
    expect(tier.annualPriceNote).toBe("/ seat / year");
    expect(tier.highlighted).toBe(true);
    expect(tier.badge).toBe("Most Popular");
    expect(tier.highlights).toContain("Minimum 3 seats");
    expect(tier.highlights).toContain("20 published apps per seat");
    expect(tier.highlights).toContain("3 workspace connections per seat");
  });

  it("maps an annual-only sales-assisted plan (Enterprise) as coming-soon with unlimited limits", () => {
    const tier = mapPlanToTier(enterprisePlan());

    // No monthly price -> the yearly price is shown in both interval views.
    expect(tier.monthlyPrice).toBe("$25,000");
    expect(tier.monthlyPriceNote).toBe("/ year");
    expect(tier.annualPrice).toBe("$25,000");
    expect(tier.selfServiceCheckout).toBe(false);
    expect(tier.cta).toBe("Coming 2027");
    expect(tier.ctaLink).toBe("");
    expect(tier.trialDays).toBeNull();
    expect(tier.highlights).toContain("Unlimited published apps");
    expect(tier.highlights).toContain("Unlimited workspace connections");
  });
});

describe("mapPlansToTiers", () => {
  it("preserves plan order", () => {
    const tiers = mapPlansToTiers(allPlans());
    expect(tiers.map((t) => t.slug)).toEqual([
      SubscriptionTierSlug.Individual,
      SubscriptionTierSlug.Team,
      SubscriptionTierSlug.Enterprise,
    ]);
  });
});

describe("buildComparison", () => {
  it("derives the published-apps row from plan limits (per-seat and unlimited)", () => {
    const rows = buildComparison(allPlans());
    const apps = rows.find((r) => r.feature === "Published apps");

    expect(apps).toBeDefined();
    expect(apps!.values[SubscriptionTierSlug.Individual]).toBe("10");
    expect(apps!.values[SubscriptionTierSlug.Team]).toBe("20 / seat");
    expect(apps!.values[SubscriptionTierSlug.Enterprise]).toBe("Unlimited");
  });

  it("derives the free-trial row from plan trial terms", () => {
    const rows = buildComparison(allPlans());
    const trial = rows.find((r) => r.feature === "Free trial");

    expect(trial!.values[SubscriptionTierSlug.Individual]).toBe("14 days");
    expect(trial!.values[SubscriptionTierSlug.Team]).toBe("14 days");
    expect(trial!.values[SubscriptionTierSlug.Enterprise]).toBe(false);
  });
});

describe("buildFaqs", () => {
  it("fills seat-minimum and trial-length copy from the plan catalog", () => {
    const faqs = buildFaqs(allPlans());
    const seatFaq = faqs.find((f) => f.q.includes("seat billing"));
    const trialFaq = faqs.find((f) => f.q.includes("free trial"));

    expect(seatFaq!.a).toContain("minimum of 3 seats");
    expect(trialFaq!.a).toContain("14-day free trial");
  });
});

describe("getTierBySlug", () => {
  it("finds a tier case- and whitespace-insensitively", () => {
    const tiers = mapPlansToTiers(allPlans());
    expect(getTierBySlug(tiers, "  TEAM ")?.slug).toBe(
      SubscriptionTierSlug.Team,
    );
    expect(getTierBySlug(tiers, null)).toBeUndefined();
  });
});

describe("getUpgradeTiers", () => {
  it("returns higher-ranked self-service tiers and excludes Enterprise", () => {
    const tiers = mapPlansToTiers(allPlans());

    expect(getUpgradeTiers(tiers, null).map((t) => t.slug)).toEqual([
      SubscriptionTierSlug.Individual,
      SubscriptionTierSlug.Team,
    ]);
    expect(getUpgradeTiers(tiers, "individual").map((t) => t.slug)).toEqual([
      SubscriptionTierSlug.Team,
    ]);
    expect(getUpgradeTiers(tiers, "team")).toEqual([]);
  });
});

describe("getDowngradeTiers", () => {
  it("returns lower-ranked self-service tiers and excludes Enterprise", () => {
    const tiers = mapPlansToTiers(allPlans());

    expect(getDowngradeTiers(tiers, "team").map((t) => t.slug)).toEqual([
      SubscriptionTierSlug.Individual,
    ]);
    expect(getDowngradeTiers(tiers, "individual")).toEqual([]);
    expect(getDowngradeTiers(tiers, "trial")).toEqual([]);
    expect(getDowngradeTiers(tiers, null)).toEqual([]);
  });

  it("compares the current slug case- and whitespace-insensitively", () => {
    const tiers = mapPlansToTiers(allPlans());

    expect(getDowngradeTiers(tiers, "  TEAM ").map((t) => t.slug)).toEqual([
      SubscriptionTierSlug.Individual,
    ]);
  });
});

describe("formatPlanPriceLabel", () => {
  it("formats monthly and annual labels", () => {
    const individual = mapPlanToTier(individualPlan());
    const team = mapPlanToTier(teamPlan());

    expect(formatPlanPriceLabel(individual, "monthly")).toBe("$20 / month");
    expect(formatPlanPriceLabel(individual, "annual")).toBe("$220 / year");
    expect(formatPlanPriceLabel(team, "monthly")).toBe("$15 / seat / month");
  });
});

describe("buildTrialMessage", () => {
  it("includes the trial length, price, and billing date", () => {
    const message = buildTrialMessage(14, "$20 / month", "1/15/2026");

    expect(message).toContain("Free for 14 days");
    expect(message).toContain("$20 / month");
    expect(message).toContain("1/15/2026");
    expect(message).toContain("cancel");
  });
});
