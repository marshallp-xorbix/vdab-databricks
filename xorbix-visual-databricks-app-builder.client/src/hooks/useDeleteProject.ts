import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProject } from "../api/projectsApi";
import { projectKeys } from "./useProjects";

/** Deletes a project and refreshes the active project list. */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: async (_result, projectId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
