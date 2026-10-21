import { useQuery } from "@tanstack/react-query";
import { getProjectWorkflow } from "../api/projectWorkflowApi";

export const projectWorkflowKeys = {
  all: ["project-workflows"] as const,
  detail: (projectId: string) => [...projectWorkflowKeys.all, projectId] as const,
};

/** Loads one project's workflow document through the versioned API. */
export function useProjectWorkflow(projectId: string | undefined) {
  return useQuery({
    queryKey: projectWorkflowKeys.detail(projectId ?? ""),
    queryFn: ({ signal }) => getProjectWorkflow(projectId ?? "", signal),
    enabled: projectId !== undefined && projectId.length > 0,
  });
}
