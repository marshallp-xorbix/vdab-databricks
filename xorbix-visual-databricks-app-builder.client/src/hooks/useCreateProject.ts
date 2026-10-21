import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../api/projectsApi";
import { projectKeys } from "./useProjects";

/** Creates a project and refreshes the user's project list. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
