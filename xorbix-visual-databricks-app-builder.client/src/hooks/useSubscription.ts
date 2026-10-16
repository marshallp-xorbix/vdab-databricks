import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { billingApi } from "../providers/BillingApi";
import { Subscription } from "../models";
import { SubscriptionTierSlug } from "../types/subscriptionTier";
import { useIdentity } from "../context/IdentityContext";

/**
 * Common Stripe subscription statuses treated as "paid/usable" by the UI.
 * Kept local to the hook; callers that need the raw status string can read
 * `subscription.status` directly.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Normalizes a tier string (e.g. "Team", "TEAM", " team ") to its canonical
 * lowercase slug for comparison against `SubscriptionTierSlug`.
 */
export function normalizeTier(tier: string | undefined | null): string {
  return (tier ?? "").trim().toLowerCase();
}

/**
 * Returns true when the subscription's tier matches the given slug.
 * Case- and whitespace-insensitive. Safe with `null`/`undefined`.
 */
export function isTier(
  subscriptionOrTier:
    | Subscription
    | { tier?: string | null }
    | string
    | null
    | undefined,
  slug: SubscriptionTierSlug,
): boolean {
  const tier =
    typeof subscriptionOrTier === "string"
      ? subscriptionOrTier
      : (subscriptionOrTier?.tier ?? null);
  return normalizeTier(tier) === slug;
}

export interface IUseSubscriptionOptions {
  /**
   * Gate loading. When `false`, the hook stays idle (no request, `loading`
   * is `false`, `subscription` is `null`). Defaults to `true`.
   */
  enabled?: boolean;
}

export interface IUseSubscriptionResult {
  /** Loaded subscription, or `null` when none exists / not yet loaded. */
  subscription: Subscription | null;
  /** True while the initial fetch (or a manual refetch) is in flight. */
  loading: boolean;
  /** Populated when the fetch fails. `null` on success or "no subscription". */
  error: unknown;
  /** Re-fetch the subscription from the API. */
  refetch: () => Promise<Subscription | null>;
  /** Replace the current subscription in-place (e.g. after a mutation). */
  setSubscription: (subscription: Subscription | null) => void;

  /** Normalized tier slug ("", "trial", "individual", "team", "enterprise"). */
  tier: string;
  /** True when a subscription object exists, regardless of status. */
  hasSubscription: boolean;
  /**
   * True when the tenant has a Stripe customer backing the plan. `false` for
   * manually provisioned plans (e.g. an administrator tier override) that have
   * no Stripe billing account. Used to gate billing and invoice features.
   */
  hasStripeCustomer: boolean;

  // Tier predicates
  isTrialTier: boolean;
  isIndividualTier: boolean;
  isTeamTier: boolean;
  isEnterpriseTier: boolean;
  /**
   * True when the tenant is an internal/dev allowlisted tenant that may manage
   * seats and invites without Stripe seat purchases.
   */
  allowsComplimentarySeatManagement: boolean;
  /**
   * True when Seats & Users / team invite UI should be available
   * (Team tier or complimentary internal/dev tenant).
   */
  canUseSeatManagement: boolean;

  // Status predicates
  /** `status === "active" || status === "trialing"`. */
  isActive: boolean;
  /** `status === "trialing"`. */
  isTrialing: boolean;
  /** True when the subscription is flagged to cancel at period end. */
  isCanceling: boolean;
  /** True when `canceledAt` is set. */
  isCanceled: boolean;
  /** True when an active promotional discount is present on the subscription. */
  hasActivePromo: boolean;
}

/**
 * Loads the current tenant's subscription via {@link billingApi.getSubscription}
 * and exposes the common tier/status predicates used across the UI.
 *
 * Failures surface through `error` and leave `subscription` as `null`; callers
 * that only care about the happy path can ignore `error` and treat a `null`
 * subscription as "no plan yet" (matching the previous inline behavior).
 */
export function useSubscription(
  options: Readonly<IUseSubscriptionOptions> = {},
): IUseSubscriptionResult {
  const { enabled = true } = options;
  const { user } = useIdentity();
  const tenantId = user?.tenantId ?? null;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<unknown>(null);

  // Used so refetch() resolves with a useful value and can ignore stale responses.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<Subscription | null> => {
    setLoading(true);
    setError(null);
    try {
      const sub = await billingApi.getSubscription();
      if (mountedRef.current) {
        setSubscription(sub);
      }
      return sub;
    } catch (err) {
      if (mountedRef.current) {
        setSubscription(null);
        setError(err);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load();
  }, [enabled, load, tenantId]);

  const refetch = useCallback(() => load(), [load]);

  return useMemo<IUseSubscriptionResult>(() => {
    const tier = normalizeTier(subscription?.tier);
    const status = subscription?.status ?? "";
    const isTeamTier = tier === SubscriptionTierSlug.Team;
    const allowsComplimentarySeatManagement =
      subscription?.allowsComplimentarySeatManagement === true;

    return {
      subscription,
      loading,
      error,
      refetch,
      setSubscription,

      tier,
      hasSubscription: subscription !== null,
      hasStripeCustomer: subscription?.hasStripeCustomer ?? false,

      isTrialTier: tier === SubscriptionTierSlug.Trial,
      isIndividualTier: tier === SubscriptionTierSlug.Individual,
      isTeamTier,
      isEnterpriseTier: tier === SubscriptionTierSlug.Enterprise,
      allowsComplimentarySeatManagement,
      canUseSeatManagement: isTeamTier || allowsComplimentarySeatManagement,

      isActive: ACTIVE_STATUSES.has(status),
      isTrialing: status === "trialing",
      isCanceling: subscription?.cancelAtPeriodEnd === true,
      isCanceled: subscription?.canceledAt != null,
      hasActivePromo: subscription?.discount != null,
    };
  }, [subscription, loading, error, refetch]);
}
