import { useQuery } from "@tanstack/react-query";
import { healthApi } from "../api/HealthApi";

export const healthKeys = {
  all: ["health"] as const,
};

export function useHealthStatus() {
  const REFRESH_INTERVAL = 30_000;
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: () => healthApi.getHealth(),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: REFRESH_INTERVAL,
  });
}
