import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { billingApi } from "../providers/BillingApi";
import { buildComparison, buildFaqs, mapPlansToTiers } from "../lib/pricing";
import type { ComparisonRow, Faq, Tier } from "../types/pricing";

export interface IUsePricingTiersResult {
  /** Presentation tiers in display order. Empty until the catalog loads. */
  tiers: Tier[];
  /** Feature-comparison rows derived from the plan catalog. */
  comparison: ComparisonRow[];
  /** Pricing FAQs derived from the plan catalog. */
  faqs: Faq[];
  /** True while the catalog is being fetched. */
  loading: boolean;
  /** Populated when the fetch fails. `null` on success. */
  error: unknown;
  /** Re-fetch the plan catalog. */
  refetch: () => Promise<void>;
}

/**
 * Loads the subscription plan catalog from the backend (`GET /api/Billing/plans`) and derives the
 * pricing tiers, feature comparison, and FAQs that the marketing and checkout UIs render. This is
 * the single source of pricing/limit data on the client, replacing the previously hardcoded list.
 */
export function usePricingTiers(): IUsePricingTiersResult {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const plans = await billingApi.getPlans();
      if (!mountedRef.current) return;
      setTiers(mapPlansToTiers(plans));
      setComparison(buildComparison(plans));
      setFaqs(buildFaqs(plans));
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return useMemo<IUsePricingTiersResult>(
    () => ({ tiers, comparison, faqs, loading, error, refetch }),
    [tiers, comparison, faqs, loading, error, refetch],
  );
}
