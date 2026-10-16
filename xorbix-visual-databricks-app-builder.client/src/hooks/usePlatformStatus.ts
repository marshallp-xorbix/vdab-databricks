import { useQuery } from "@tanstack/react-query";
import { statusApi } from "../api/StatusApi";

export const platformStatusKeys = {
  all: ["platform-status"] as const,
};

export function usePlatformStatus() {
  const REFRESH_INTERVAL = 30_000;
  return useQuery({
    queryKey: platformStatusKeys.all,
    queryFn: () => statusApi.getStatus(),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: REFRESH_INTERVAL,
  });
}
