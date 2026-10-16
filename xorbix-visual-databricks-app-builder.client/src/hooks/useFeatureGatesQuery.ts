import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { featuresApi } from "../providers/FeaturesApi";

export const featureGateKeys = {
  all: ["featureGates"] as const,
};

export const useFeatureGatesQuery = () => {
  const queryClient = useQueryClient();

  const fetchFeatureGates = useCallback(async () => {
    return await queryClient.fetchQuery({
      queryKey: featureGateKeys.all,
      queryFn: () => featuresApi.getFeatureGates(),
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  return { fetchFeatureGates };
};
