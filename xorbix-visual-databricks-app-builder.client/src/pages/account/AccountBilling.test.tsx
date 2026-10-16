import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Subscription } from "../../models";
import { SubscriptionTierSlug } from "../../types/subscriptionTier";
import type { Tier } from "../../types/pricing";
import AccountBilling from "./AccountBilling";

const mockUseSubscription = vi.fn();
const mockUsePricingTiers = vi.fn();
const mockUpdateSubscription = vi.fn();
const mockCancelSubscription = vi.fn();
const mockToast = vi.fn();

vi.mock("../../hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("../../hooks/usePricingTiers", () => ({
  usePricingTiers: () => mockUsePricingTiers(),
}));

vi.mock("../../hooks/useAccountSetupStatus", () => ({
  useInvalidateAccountSetupStatus: () => vi.fn(),
}));

vi.mock("../../components/PaymentMethodSection", () => ({
  PaymentMethodSection: () => <div data-testid="payment-method-section" />,
}));

vi.mock("../../providers/BillingApi", () => ({
  billingApi: {
    updateSubscription: (request: unknown) => mockUpdateSubscription(request),
    cancelSubscription: () => mockCancelSubscription(),
  },
}));

vi.mock("../../components/ui/use-toast", () => ({
  toast: (args: unknown) => mockToast(args),
}));

function makeTier(overrides: Partial<Tier> & Pick<Tier, "slug" | "name">): Tier {
  return {
    monthlyPrice: "$20",
    monthlyPriceNote: "/ month",
    annualPrice: "$220",
    annualPriceNote: "/ year",
    annualBillingNote: "billed annually",
    description: "Test plan",
    cta: "Get Started",
    ctaLink: "/signup",
    highlighted: false,
    badge: null,
    highlights: [],
    selfServiceCheckout: true,
    trialDays: 14,
    ...overrides,
  };
}

const pricingTiers: Tier[] = [
  makeTier({
    slug: SubscriptionTierSlug.Individual,
    name: "Individual",
  }),
  makeTier({
    slug: SubscriptionTierSlug.Team,
    name: "Team",
    monthlyPrice: "$15",
    monthlyPriceNote: "/ seat / month",
    highlighted: true,
    badge: "Most Popular",
  }),
];

function makeTeamSubscription(
  occupiedSeats: number,
  billingInterval: string = "Monthly",
): Subscription {
  return new Subscription({
    id: "sub_1",
    tier: SubscriptionTierSlug.Team,
    billingInterval,
    status: "active",
    cancelAtPeriodEnd: false,
    totalSeats: 5,
    hasStripeCustomer: true,
    seatSummary: {
      totalSeats: 5,
      occupiedSeats,
      availableSeats: Math.max(0, 5 - occupiedSeats),
      bundledSeats: 3,
      extraSeats: 2,
      pendingCancellationSeats: 0,
    },
  });
}

function renderBilling(
  occupiedSeats: number,
  billingInterval: string = "Monthly",
) {
  mockUseSubscription.mockReturnValue({
    subscription: makeTeamSubscription(occupiedSeats, billingInterval),
    loading: false,
    hasStripeCustomer: true,
    refetch: vi.fn(),
  });
  mockUsePricingTiers.mockReturnValue({
    tiers: pricingTiers,
    loading: false,
    error: null,
  });

  return render(
    <MemoryRouter>
      <AccountBilling />
    </MemoryRouter>,
  );
}

describe("AccountBilling downgrade occupancy gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables downgrade and shows the manage-seats alert when more than one seat is occupied", () => {
    renderBilling(2);

    expect(
      screen.getByRole("button", { name: "Downgrade to Individual" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Downgrade is blocked while more than one seat is occupied/,
    );
    expect(
      screen.getByRole("link", { name: "Manage seats" }),
    ).toHaveAttribute("href", "/account/seats");
  });

  it("enables downgrade and shows instructional copy when at most one seat is occupied", () => {
    renderBilling(1);

    expect(
      screen.getByRole("button", { name: "Downgrade to Individual" }),
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Move to the Individual plan/),
    ).toBeInTheDocument();
  });

  it("blocks downgrade when seat usage cannot be confirmed (missing seat summary)", () => {
    mockUseSubscription.mockReturnValue({
      subscription: new Subscription({
        id: "sub_1",
        tier: SubscriptionTierSlug.Team,
        status: "active",
        cancelAtPeriodEnd: false,
        totalSeats: 5,
        hasStripeCustomer: true,
        // seatSummary intentionally omitted (e.g. a transient backend failure).
      }),
      loading: false,
      hasStripeCustomer: true,
      refetch: vi.fn(),
    });
    mockUsePricingTiers.mockReturnValue({
      tiers: pricingTiers,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <AccountBilling />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Downgrade to Individual" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /couldn't confirm your current seat usage/,
    );
  });

  it("preserves the subscriber's billing interval on downgrade instead of forcing monthly", async () => {
    mockUpdateSubscription.mockResolvedValue(makeTeamSubscription(1, "Yearly"));
    renderBilling(1, "Yearly");

    fireEvent.click(
      screen.getByRole("button", { name: "Downgrade to Individual" }),
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm Downgrade" }),
    );

    await waitFor(() => {
      expect(mockUpdateSubscription).toHaveBeenCalledWith({
        tier: SubscriptionTierSlug.Individual,
        billingInterval: "Yearly",
      });
    });
  });
});
