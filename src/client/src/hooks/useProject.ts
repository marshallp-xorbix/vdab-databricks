import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/projectsApi";
import { projectKeys } from "./useProjects";

/** Loads one ACL-filtered project while its route ID is available. */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: ({ signal }) => getProject(projectId ?? "", signal),
    enabled: Boolean(projectId),
  });
}
