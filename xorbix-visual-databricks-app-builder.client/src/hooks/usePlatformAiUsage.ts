import { useQuery } from "@tanstack/react-query";
import { aiBuilderModelApi } from "../api/AiBuilderModelApi";

export const aiBuilderPlatformUsageKeys = {
  all: ["aiBuilder", "platformUsage"] as const,
  current: () => [...aiBuilderPlatformUsageKeys.all, "current"] as const,
};

export function usePlatformAiUsage(enabled = true) {
  const query = useQuery({
    queryKey: aiBuilderPlatformUsageKeys.current(),
    queryFn: () => aiBuilderModelApi.getPlatformUsage(),
    enabled,
  });

  return {
    usage: query.data,
    isLoading: query.isPending,
    isRefreshing: query.isFetching && !query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
