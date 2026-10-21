import { useQuery } from "@tanstack/react-query";
import { getProjectCustomModules } from "../api/projectCustomModulesApi";

export const projectCustomModulesKeys = {
  all: ["project-custom-modules"] as const,
  detail: (projectId: string) => [...projectCustomModulesKeys.all, projectId] as const,
};

/** Loads one project's custom Python module document. */
export function useProjectCustomModules(projectId: string | undefined) {
  return useQuery({
    queryKey: projectCustomModulesKeys.detail(projectId ?? ""),
    queryFn: ({ signal }) => getProjectCustomModules(projectId ?? "", signal),
    enabled: projectId !== undefined && projectId.length > 0,
  });
}
