import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Plan } from "../../models";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import { usePricingTiers } from "../usePricingTiers";

vi.mock("../../providers/BillingApi", () => ({
  billingApi: {
    getPlans: vi.fn(),
  },
}));

// Imported after the mock so the mocked instance is what we interact with.
import { billingApi } from "../../providers/BillingApi";

const getPlansMock = billingApi.getPlans as unknown as ReturnType<typeof vi.fn>;

function makePlans(): Plan[] {
  return [
    new Plan({
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
    }),
    new Plan({
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
    }),
  ];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePricingTiers", () => {
  it("loads the plan catalog and derives tiers, comparison, and faqs", async () => {
    getPlansMock.mockResolvedValueOnce(makePlans());

    const { result } = renderHook(() => usePricingTiers());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getPlansMock).toHaveBeenCalledTimes(1);
    expect(result.current.tiers.map((t) => t.slug)).toEqual([
      SubscriptionTierSlug.Individual,
      SubscriptionTierSlug.Team,
    ]);
    expect(result.current.comparison.length).toBeGreaterThan(0);
    expect(result.current.faqs.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it("captures errors and leaves the catalog empty", async () => {
    const failure = new Error("boom");
    getPlansMock.mockRejectedValueOnce(failure);

    const { result } = renderHook(() => usePricingTiers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tiers).toEqual([]);
    expect(result.current.comparison).toEqual([]);
    expect(result.current.faqs).toEqual([]);
    expect(result.current.error).toBe(failure);
  });
});
