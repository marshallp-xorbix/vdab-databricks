import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Subscription } from "../../models";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import { isTier, normalizeTier, useSubscription } from "../useSubscription";

vi.mock("../../providers/BillingApi", () => ({
  billingApi: {
    getSubscription: vi.fn(),
  },
}));

// Imported after the mock so the mocked instance is what we interact with.
import { billingApi } from "../../providers/BillingApi";

const getSubscriptionMock = billingApi.getSubscription as unknown as ReturnType<
  typeof vi.fn
>;

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return new Subscription({
    id: "sub_1",
    tier: SubscriptionTierSlug.Team,
    status: "active",
    cancelAtPeriodEnd: false,
    totalSeats: 5,
    ...overrides,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("normalizeTier", () => {
  it("lowercases and trims the tier string", () => {
    expect(normalizeTier("  Team  ")).toBe("team");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeTier(null)).toBe("");
    expect(normalizeTier(undefined)).toBe("");
  });
});

describe("isTier", () => {
  it("matches canonical slugs case-insensitively", () => {
    const sub = makeSubscription({ tier: "TEAM" });
    expect(isTier(sub, SubscriptionTierSlug.Team)).toBe(true);
    expect(isTier(sub, SubscriptionTierSlug.Individual)).toBe(false);
  });

  it("accepts a raw tier string", () => {
    expect(isTier("individual", SubscriptionTierSlug.Individual)).toBe(true);
  });

  it("safely handles null/undefined", () => {
    expect(isTier(null, SubscriptionTierSlug.Team)).toBe(false);
    expect(isTier(undefined, SubscriptionTierSlug.Trial)).toBe(false);
    expect(isTier({ tier: null }, SubscriptionTierSlug.Team)).toBe(false);
  });
});

describe("useSubscription", () => {
  it("loads the subscription on mount and exposes tier/status flags", async () => {
    const sub = makeSubscription({ tier: "Team", status: "active" });
    getSubscriptionMock.mockResolvedValueOnce(sub);

    const { result } = renderHook(() => useSubscription());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(result.current.subscription).toBe(sub);
    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("team");
    expect(result.current.isTeamTier).toBe(true);
    expect(result.current.canUseSeatManagement).toBe(true);
    expect(result.current.allowsComplimentarySeatManagement).toBe(false);
    expect(result.current.isIndividualTier).toBe(false);
    expect(result.current.isTrialTier).toBe(false);
    expect(result.current.isEnterpriseTier).toBe(false);
    expect(result.current.isActive).toBe(true);
    expect(result.current.isTrialing).toBe(false);
    expect(result.current.isCanceling).toBe(false);
    expect(result.current.isCanceled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("flags trialing status as active and trialing", async () => {
    getSubscriptionMock.mockResolvedValueOnce(
      makeSubscription({ tier: "individual", status: "trialing" }),
    );

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isIndividualTier).toBe(true);
    expect(result.current.isActive).toBe(true);
    expect(result.current.isTrialing).toBe(true);
  });

  it("reports canceling and canceled flags", async () => {
    getSubscriptionMock.mockResolvedValueOnce(
      makeSubscription({
        cancelAtPeriodEnd: true,
        canceledAt: new Date("2026-01-01T00:00:00Z"),
      }),
    );

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isCanceling).toBe(true);
    expect(result.current.isCanceled).toBe(true);
  });

  it("captures errors and leaves subscription null", async () => {
    const failure = new Error("boom");
    getSubscriptionMock.mockRejectedValueOnce(failure);

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscription).toBeNull();
    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.error).toBe(failure);
    expect(result.current.isTeamTier).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it("skips fetching when enabled is false", async () => {
    const { result } = renderHook(() => useSubscription({ enabled: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getSubscriptionMock).not.toHaveBeenCalled();
    expect(result.current.subscription).toBeNull();
  });

  it("refetch reloads the subscription and returns it", async () => {
    const first = makeSubscription({ tier: "individual" });
    const second = makeSubscription({ tier: "team" });
    getSubscriptionMock
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isIndividualTier).toBe(true);

    let refetched: Subscription | null = null;
    await act(async () => {
      refetched = await result.current.refetch();
    });

    expect(refetched).toBe(second);
    expect(getSubscriptionMock).toHaveBeenCalledTimes(2);
    expect(result.current.isTeamTier).toBe(true);
  });

  it("setSubscription replaces the cached value without refetching", async () => {
    getSubscriptionMock.mockResolvedValueOnce(
      makeSubscription({ tier: "individual" }),
    );

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const replacement = makeSubscription({ tier: "enterprise" });
    act(() => {
      result.current.setSubscription(replacement);
    });

    expect(result.current.subscription).toBe(replacement);
    expect(result.current.isEnterpriseTier).toBe(true);
    expect(result.current.canUseSeatManagement).toBe(false);
    expect(getSubscriptionMock).toHaveBeenCalledTimes(1);
  });

  it("enables seat management for complimentary enterprise tenants", async () => {
    getSubscriptionMock.mockResolvedValueOnce(
      makeSubscription({
        tier: "Enterprise",
        allowsComplimentarySeatManagement: true,
      }),
    );

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isEnterpriseTier).toBe(true);
    expect(result.current.isTeamTier).toBe(false);
    expect(result.current.allowsComplimentarySeatManagement).toBe(true);
    expect(result.current.canUseSeatManagement).toBe(true);
  });
});
