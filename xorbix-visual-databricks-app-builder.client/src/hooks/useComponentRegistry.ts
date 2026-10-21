import { useQuery } from "@tanstack/react-query";
import { getComponentRegistry } from "../api/componentRegistryApi";

export const componentRegistryKeys = {
  all: ["component-registry"] as const,
};

/** Loads the standalone component registry once for builder editors. */
export function useComponentRegistry() {
  return useQuery({
    queryKey: componentRegistryKeys.all,
    queryFn: ({ signal }) => getComponentRegistry(signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
