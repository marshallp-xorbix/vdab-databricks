import { useQuery } from "@tanstack/react-query";
import { listProjects } from "../api/projectsApi";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
};

/** Loads the projects the current Databricks user may access. */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: ({ signal }) => listProjects(signal),
  });
}
