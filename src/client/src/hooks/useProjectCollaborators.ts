import { useQuery } from "@tanstack/react-query";
import { listProjectCollaborators } from "../api/projectCollaboratorsApi";

export const projectCollaboratorKeys = {
  all: ["project-collaborators"] as const,
  detail: (projectId: string) => [...projectCollaboratorKeys.all, projectId] as const,
};

/** Loads the editor grants for a project with server-state caching. */
export function useProjectCollaborators(projectId: string) {
  return useQuery({
    queryKey: projectCollaboratorKeys.detail(projectId),
    queryFn: ({ signal }) => listProjectCollaborators(projectId, signal),
  });
}
