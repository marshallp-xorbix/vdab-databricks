import { useQuery } from "@tanstack/react-query";
import type { IReportsStats } from "../models";
import { reportsApi } from "../providers/ReportsApi";

export const reportsKeys = {
  all: ["reports"] as const,
  stats: ["reports", "stats"] as const,
};

const STATS_STALE_MS = 60_000;

/**
 * Loads aggregated administrator report statistics for the dashboard.
 * Restricted server-side to the Global Administrator policy.
 */
export function useReportsStats() {
  return useQuery<IReportsStats>({
    queryKey: reportsKeys.stats,
    queryFn: () => reportsApi.getStats(),
    staleTime: STATS_STALE_MS,
  });
}
