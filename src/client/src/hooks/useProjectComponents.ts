import { useQuery } from "@tanstack/react-query";
import { getProjectComponents } from "../api/projectComponentsApi";

export const projectComponentsKeys = {
  all: ["project-components"] as const,
  detail: (projectId: string) =>
    [...projectComponentsKeys.all, projectId] as const,
};

/** Loads ordered project component data from the Node builder API. */
export function useProjectComponents(projectId: string | undefined) {
  return useQuery({
    queryKey: projectComponentsKeys.detail(projectId ?? ""),
    queryFn: ({ signal }) => getProjectComponents(projectId ?? "", signal),
    enabled: Boolean(projectId),
    refetchOnWindowFocus: false,
  });
}
